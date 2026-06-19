import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTables } from "../store";
import { fetchForeignKeyLookup, submitFormData, fetchNextConsecutive, fetchUnassignedOrders } from "../api";
import type { SubmitFormAPI } from "../api";
import { DynamicFormField } from "../components/DynamicFormField";
import { ConfirmModal } from "../components/ConfirmModal";
import { ProductComposerDialog } from "../components/ProductComposerDialog";
import { OrderProcessForm } from "../components/OrderProcessForm";
import { buildSubmitData } from "./formBuilderSubmit";
import { buildInitialFormData } from "./formDefaults";
import { deriveProductFields } from "./productDerivation";
import {
    filterForeignKeyOptions,
    FOREIGN_KEY_INLINE_OPTIONS_LIMIT,
    FOREIGN_KEY_REMOTE_DEFAULT_LIMIT,
} from "../foreignKey";
import type { ColumnSchema, TableSchema } from "../schema";
import {
    filterVisibleFormColumns,
    isProductDerivationContext,
    isProductDerivedColumnName,
} from "../rules";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import NotFound from "@/shared/components/NotFound";
import { Skeleton } from "@/shared/ui/skeleton";

function isOrderProcessForm(tableName?: string | null): boolean {
    const normalized = (tableName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return [
        "ordenproceso",
        "ordenprocesos",
        "ordenprocesoitem",
        "ordenprocesositem",
        "ordenesproceso",
        "itemprocesos",
        "itemsprocesos",
    ].includes(normalized);
}

export default function FormBuilder() {
    const navigate = useNavigate();
    const { tableId } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [selectedForeignKeyLabels, setSelectedForeignKeyLabels] = useState<
        Record<string, string>
    >({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showProductComposer, setShowProductComposer] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tableDetails, setTableDetails] = useState<TableSchema | undefined>();
    const [tableLoadError, setTableLoadError] = useState<string | null>(null);

    const { getTableById, loadTableById } = useTables();
    const tableSummary = tableId ? getTableById(tableId) : undefined;
    const table = tableDetails ?? tableSummary;

    const visibleColumns = useMemo(() => {
        if (!table) return [];
        return filterVisibleFormColumns(table.columns);
    }, [table]);

    const [legacyColumnName, setLegacyColumnName] = useState<string | null>(null);
    const [orderColumnName, setOrderColumnName] = useState<string | null>(null);
    const [clientColumnName, setClientColumnName] = useState<string | null>(null);

    const [orders, setOrders] = useState<{ value: string; order?: string; label: string; client: string; product?: string; quantity?: string; count?: number }[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [ordersQ, setOrdersQ] = useState<string | null>(null);
    const [ordersOffset, setOrdersOffset] = useState(0);
    const [ordersHasMore, setOrdersHasMore] = useState(false);
    const isProductDerivationEnabled = useMemo(
        () => isProductDerivationContext(table?.name, visibleColumns),
        [table?.name, visibleColumns],
    );

    const productColumnName = useMemo(() => {
        if (!table) return null;
        const tableName = table.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const displayName = table.displayName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
        const isPurchaseOrderTable =
            tableName.includes("ordencompra") ||
            tableName.includes("ordenescompra") ||
            displayName.includes("ordenesdecompra") ||
            displayName.includes("ordendecompra");
        if (!isPurchaseOrderTable) {
            return null;
        }

        const productColumn = visibleColumns.find((column) => {
            const name = column.name.toLowerCase();
            const foreignTable = column.foreignKeyTable
                ?.toLowerCase()
                .replace(/[^a-z0-9]/g, "");
            return (
                name === "id_producto" ||
                name === "producto_id" ||
                name.includes("producto") ||
                foreignTable === "producto" ||
                foreignTable === "productos"
            );
        });
        return productColumn?.name ?? null;
    }, [table, visibleColumns]);

    useEffect(() => {
        let cancelled = false;

        async function loadTableDetailsForForm() {
            if (!tableId || !tableSummary) {
                setTableDetails(undefined);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setTableLoadError(null);

                const resolvedTable = await loadTableById(tableId);
                if (cancelled) return;

                const nextTable = resolvedTable ?? tableSummary;
                setTableDetails(nextTable);

                const visible = filterVisibleFormColumns(nextTable.columns);
                setFormData(buildInitialFormData(visible));
                setSelectedForeignKeyLabels({});
                setErrors({});

                // Detect relevant columns for items form (legacy, order, client)
                const allCols = (nextTable.columns || []).map((c) => c.name.toLowerCase());
                const findCol = (candidates: string[]) => {
                    for (const cand of candidates) {
                        const idx = allCols.findIndex((n) => n === cand || n.includes(cand));
                        if (idx >= 0) return nextTable.columns[idx].name;
                    }
                    return null;
                };

                const legacyCandidates = [
                    "item_legado",
                    "itemlegado",
                    "item_leg",
                    "coditem",
                    "cod_item",
                    "cod_item_legado",
                    "item_legacy",
                ];
                const orderCandidates = [
                    "orden_compra",
                    "ordencompra",
                    "orden",
                    "cod_oc_cliente",
                    "codoccliente",
                    "oc_cliente",
                    "oc",
                ];
                const clientCandidates = [
                    "cliente",
                    "id_cliente",
                    "cliente_id",
                    "cod_cliente",
                ];

                const legacyCol = findCol(legacyCandidates);
                const orderCol = findCol(orderCandidates);
                const clientCol = findCol(clientCandidates);

                console.debug("[FormBuilder] detected columns", { legacyCol, orderCol, clientCol });

                setLegacyColumnName(legacyCol);
                setOrderColumnName(orderCol);
                setClientColumnName(clientCol);

                // If we found a legacy column and it's not already set in initial data, fetch next consecutive
                if (legacyCol) {
                    const current = buildInitialFormData(visible)[legacyCol as string];
                    // only fetch when initial doesn't provide a default
                    if (current === undefined) {
                        // fetch in background
                        (async () => {
                            try {
                                const resp = await fetchNextConsecutive(nextTable.name, legacyCol);
                                setFormData((prev) => ({ ...prev, [legacyCol]: resp.next }));
                            } catch (err) {
                                // ignore errors silently
                                console.warn("Could not fetch next consecutive:", err);
                            }
                        })();
                    }
                }
            } catch (error) {
                if (cancelled) return;
                setTableDetails(tableSummary);
                setTableLoadError(
                    error instanceof Error
                        ? error.message
                        : "No se pudo cargar el detalle de la tabla",
                );
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadTableDetailsForForm();

        return () => {
            cancelled = true;
        };
    }, [tableId, tableSummary, loadTableById]);

    // Load unassigned orders when we have the necessary column names
    useEffect(() => {
        let cancelled = false;
        async function loadOrders() {
            if (!table || !orderColumnName || !clientColumnName || !legacyColumnName) return;
            setOrdersLoading(true);
            try {
                const resp = await fetchUnassignedOrders({
                    tableName: table.name,
                    orderColumn: orderColumnName,
                    clientColumn: clientColumnName,
                    legacyColumn: legacyColumnName,
                    q: ordersQ ?? undefined,
                    limit: 10,
                    offset: ordersOffset,
                });
                if (cancelled) return;
                setOrders(resp.items || []);
                setOrdersHasMore(Boolean(resp.has_more));
            } catch (err) {
                console.error("Error loading unassigned orders:", err);
                setOrders([]);
                setOrdersHasMore(false);
            } finally {
                if (!cancelled) setOrdersLoading(false);
            }
        }
        loadOrders();
        return () => {
            cancelled = true;
        };
    }, [table, orderColumnName, clientColumnName, legacyColumnName, ordersQ, ordersOffset]);

    useEffect(() => {
        if (!table || !isProductDerivationEnabled) {
            return;
        }

        const derived = deriveProductFields(
            table.name,
            visibleColumns,
            formData,
            selectedForeignKeyLabels,
        );
        setFormData((previous) => {
            if (
                previous.sku === derived.sku &&
                previous.nombre === derived.nombre
            ) {
                return previous;
            }

            return {
                ...previous,
                sku: derived.sku,
                nombre: derived.nombre,
            };
        });
    }, [
        table,
        isProductDerivationEnabled,
        visibleColumns,
        formData,
        selectedForeignKeyLabels,
    ]);

    const handleForeignKeyLookup = useCallback(
        async (
            column: ColumnSchema,
            query: string,
            limit = FOREIGN_KEY_REMOTE_DEFAULT_LIMIT,
        ) => {
            const localOptions = column.foreignKeyOptions ?? [];
            const isSmallLookup =
                localOptions.length > 0 &&
                localOptions.length <= FOREIGN_KEY_INLINE_OPTIONS_LIMIT;

            if (isSmallLookup) {
                return filterForeignKeyOptions(localOptions, query, limit);
            }

            if (!table) {
                return filterForeignKeyOptions(localOptions, query, limit);
            }

            try {
                return await fetchForeignKeyLookup({
                    tableName: table.name,
                    columnName: column.name,
                    query,
                    limit,
                });
            } catch (error) {
                if (localOptions.length > 0) {
                    return filterForeignKeyOptions(localOptions, query, limit);
                }
                throw error;
            }
        },
        [table],
    );

    const handleFieldChange = (fieldName: string, value: any) => {
        setFormData((prev) => ({ ...prev, [fieldName]: value }));
        if (value === undefined || value === null || value === "") {
            setSelectedForeignKeyLabels((prev) => {
                if (!(fieldName in prev)) return prev;
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }

        if (errors[fieldName]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }
    };

    const handleForeignKeyLabelChange = useCallback(
        (columnName: string, label: string) => {
            setSelectedForeignKeyLabels((prev) => {
                if (prev[columnName] === label) return prev;
                return {
                    ...prev,
                    [columnName]: label,
                };
            });
        },
        [],
    );

    const validateForm = (): boolean => {
        if (!table) return false;

        const nextErrors: Record<string, string> = {};

        visibleColumns.forEach((column) => {
            const value = formData[column.name];
            const isRequired = column.required && !column.nullable;

            if (
                isRequired &&
                (value === undefined || value === null || value === "")
            ) {
                nextErrors[column.name] = "Este campo es obligatorio";
            }
        });

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (validateForm()) {
            setShowConfirmModal(true);
            return;
        }

        toast.error("Formulario incompleto", {
            description: "Por favor completa todos los campos obligatorios",
        });
    };

    const handleConfirm = async () => {
        if (!table) return;

        setShowConfirmModal(false);
        setIsSubmitting(true);

        try {
            const payload: SubmitFormAPI = {
                table_name: table.name,
                data: buildSubmitData(visibleColumns, formData, table.name, {
                    normalizeProductSku: isProductDerivationEnabled,
                }),
            };

            const result = await submitFormData(payload);

            if (result.status === "success") {
                toast.success("Registro guardado", {
                    description:
                        "El registro ha sido creado exitosamente en " +
                        table.displayName +
                        ". ID: " +
                        result.correlation_id,
                });

                handleClearForm();
            }
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("Error al guardar", {
                description:
                    error instanceof Error
                        ? error.message
                        : "No se pudo guardar el registro",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClearForm = () => {
        if (!table) return;

        setFormData(buildInitialFormData(visibleColumns));
        setSelectedForeignKeyLabels({});
        setErrors({});
        toast.info("Formulario limpiado");
    };

    if (!tableSummary && !isLoading) {
        return <NotFound />;
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/80 bg-card/80 backdrop-blur">
                <div className="container mx-auto max-w-5xl px-4 py-5">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/app/forms")}
                            className="text-foreground hover:bg-muted/60"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Button>
                        <div className="h-8 w-px bg-border" aria-hidden />
                        <div>
                            <h1 className="text-2xl font-semibold leading-tight text-foreground">
                                {table?.displayName}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Nuevo registro
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-5xl px-4 py-8">
                <Card className="border border-border/80 shadow-sm bg-card">
                    <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="text-xl font-semibold text-foreground">
                            Nuevo registro: {table?.displayName}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {tableLoadError && (
                            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                {tableLoadError}
                            </p>
                        )}
                        {isLoading ? (
                            <div className="space-y-6">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : isOrderProcessForm(table?.name) ? (
                            <OrderProcessForm />
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {visibleColumns.map((column) => (
                                        <div
                                            key={column.name}
                                            className={
                                                column.type === "text"
                                                    ? "md:col-span-2"
                                                    : ""
                                            }
                                        >
                                            <DynamicFormField
                                                column={column}
                                                value={formData[column.name]}
                                                tableName={table?.name}
                                                                forceReadOnly={
                                                                    (isProductDerivationEnabled &&
                                                                        isProductDerivedColumnName(
                                                                            column.name,
                                                                        )) ||
                                                                    (legacyColumnName !== null &&
                                                                        column.name === legacyColumnName)
                                                                }
                                                forceAsInput={orderColumnName !== null && column.name === orderColumnName}
                                                onChange={(value) =>
                                                    handleFieldChange(
                                                        column.name,
                                                        value,
                                                    )
                                                }
                                                onForeignKeyLabelChange={
                                                    handleForeignKeyLabelChange
                                                }
                                                onForeignKeyLookup={
                                                    handleForeignKeyLookup
                                                }
                                                error={errors[column.name]}
                                                    selectedForeignKeyLabels={selectedForeignKeyLabels}
                                            />
                                            {productColumnName === column.name && (
                                                <div className="mt-2 flex justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setShowProductComposer(true)
                                                        }
                                                    >
                                                        Crear producto
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Unassigned orders selector */}
                                {(orderColumnName && clientColumnName && legacyColumnName) && (
                                    <div className="mt-6 p-4 rounded border border-border/60 bg-muted/5 md:col-span-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-medium">Órdenes sin Item legado</h3>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="search"
                                                    placeholder="Buscar orden o cliente..."
                                                    value={ordersQ ?? ""}
                                                    onChange={(e) => { setOrdersQ(e.target.value || null); setOrdersOffset(0); }}
                                                    className="input input-sm"
                                                />
                                            </div>
                                        </div>
                                        {ordersLoading ? (
                                            <div className="text-sm text-muted-foreground">Cargando órdenes...</div>
                                        ) : orders.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">No se encontraron órdenes sin item legado.</div>
                                        ) : (
                                            <div className="space-y-3">
                                                <ul className="space-y-2 max-h-52 overflow-auto">
                                                    {orders.map((o) => (
                                                        <li key={o.value} className="flex items-center justify-between gap-4 bg-card/50 p-3 rounded">
                                                            <div className="flex-1 text-sm">
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-xs text-muted-foreground">Orden:</span>
                                                                    <span className="font-medium text-foreground">{o.order || o.value}</span>
                                                                </div>
                                                                <div className="flex items-baseline gap-2 mt-1">
                                                                    <span className="text-xs text-muted-foreground">Cliente:</span>
                                                                    <span className="text-sm text-foreground">{o.client || '-'}</span>
                                                                </div>
                                                                <div className="flex items-baseline gap-2 mt-1">
                                                                    <span className="text-xs text-muted-foreground">Producto:</span>
                                                                    <span className="text-sm text-foreground">{o.product || '-'}</span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                                                    <span className="inline-flex items-center gap-1 rounded border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                                                                        Cantidad:
                                                                        <strong className="text-foreground">{o.quantity || '-'}</strong>
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1 rounded border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                                                                        Conteo:
                                                                        <strong className="text-foreground">{o.count ?? 0}</strong>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex-shrink-0">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm"
                                                                    onClick={() => {
                                                                        if (!legacyColumnName || !table) return;
                                                                        (async () => {
                                                                            try {
                                                                                const resp = await fetchNextConsecutive(table.name, legacyColumnName);

                                                                                // set legacy and order immediately
                                                                                setFormData((prev) => ({
                                                                                    ...prev,
                                                                                    [legacyColumnName]: resp.next,
                                                                                    ...(orderColumnName ? { [orderColumnName]: o.value } : {}),
                                                                                }));

                                                                                // try to resolve client FK value -> label mapping
                                                                                if (clientColumnName) {
                                                                                    try {
                                                                                        const lookup = await fetchForeignKeyLookup({
                                                                                            tableName: table.name,
                                                                                            columnName: clientColumnName,
                                                                                            query: o.client || o.value,
                                                                                            limit: 5,
                                                                                        });

                                                                                        if (Array.isArray(lookup) && lookup.length > 0) {
                                                                                            // prefer exact label match
                                                                                            const match = lookup.find((opt) => opt.label === o.client) || lookup[0];
                                                                                            setFormData((prev) => ({ ...prev, [clientColumnName]: match.value }));
                                                                                            handleForeignKeyLabelChange(clientColumnName, match.label);
                                                                                        } else {
                                                                                            // fallback: set the raw client value/label
                                                                                            setFormData((prev) => ({ ...prev, [clientColumnName]: o.client }));
                                                                                            handleForeignKeyLabelChange(clientColumnName, o.client || "");
                                                                                        }
                                                                                    } catch (err) {
                                                                                        // lookup failed, fallback to raw value
                                                                                        setFormData((prev) => ({ ...prev, [clientColumnName]: o.client }));
                                                                                        handleForeignKeyLabelChange(clientColumnName, o.client || "");
                                                                                    }
                                                                                }

                                                                                toast.success("Item legado asignado al formulario");
                                                                            } catch (err) {
                                                                                console.error(err);
                                                                                toast.error("No se pudo obtener el consecutivo");
                                                                            }
                                                                        })();
                                                                    }}
                                                                >
                                                                    Seleccionar
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                                {ordersHasMore && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setOrdersOffset((current) => current + 10)}
                                                    >
                                                        Cargar más
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-6 border-t">
                                    <Button
                                        type="submit"
                                        className="flex-1 sm:flex-none bg-accent hover:bg-accent/90 text-accent-foreground"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-2" />
                                        )}
                                        {isSubmitting
                                            ? "Guardando..."
                                            : "Guardar"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClearForm}
                                        className="flex-1 sm:flex-none"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Limpiar
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </main>

            <ConfirmModal
                open={showConfirmModal}
                onOpenChange={setShowConfirmModal}
                onConfirm={handleConfirm}
                tableName={table?.displayName ?? ""}
            />
            <ProductComposerDialog
                open={showProductComposer}
                onOpenChange={setShowProductComposer}
                onProductCreated={(product) => {
                    if (!productColumnName) return;
                    handleFieldChange(productColumnName, String(product.id));
                    handleForeignKeyLabelChange(productColumnName, product.label);
                    toast.success("Producto listo para la orden de compra");
                }}
            />
        </div>
    );
}

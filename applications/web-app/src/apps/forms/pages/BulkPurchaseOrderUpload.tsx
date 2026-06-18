import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    FileSpreadsheet,
    Loader2,
    Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
    commitBulkPurchaseOrders,
    previewBulkPurchaseOrders,
    revalidateBulkPurchaseOrderProduct,
} from "../api";
import type { BulkPurchaseOrderPreviewAPI, BulkPurchaseOrderRowAPI } from "../api";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/table";

type HomologationField =
    | "base"
    | "modelo"
    | "referencia_1"
    | "referencia_2"
    | "referencia_3"
    | "tela";
type HomologationMode = "homologar" | "crear";

const MISSING_LABELS: Record<string, string> = {
    cliente: "Cliente",
    base: "Base",
    modelo: "Modelo",
    referencia_1: "Referencia 1",
    referencia_2: "Referencia 2",
    referencia_3: "Referencia 3",
    tela: "Tela",
    producto: "Producto",
};

function isRowReadyForCommit(row: BulkPurchaseOrderRowAPI): boolean {
    if (row.missing.includes("cliente")) {
        return false;
    }
    if (row.resolved?.producto_id) {
        return true;
    }

    const hasBaseData = (["base", "modelo"] as HomologationField[]).every(
        (field) =>
            Boolean(row.resolved?.[`${field}_id`]) ||
            String(row.suggested?.[field] ?? "").trim().length > 0,
    );
    const hasFabricData =
        Boolean(row.resolved?.tela_id) ||
        (
            String(row.suggested?.tela_nombre ?? "").trim().length > 0 &&
            Boolean(row.resolved?.tela_unidad_medida_id)
        );

    return hasBaseData && hasFabricData;
}

function MissingBadges({ row }: { row: BulkPurchaseOrderRowAPI }) {
    const isReady = isRowReadyForCommit(row);

    return (
        <Badge
            variant={isReady ? "secondary" : "outline"}
            className={
                isReady
                    ? "bg-emerald-100 text-emerald-800"
                    : "border-amber-300 text-amber-800"
            }
        >
            {isReady ? "Finalizada" : "Pendiente"}
        </Badge>
    );
}

function cleanProductPart(value: unknown): string {
    return String(value ?? "").trim();
}

function uniqueProductParts(parts: string[]): string[] {
    const seen = new Set<string>();
    return parts.filter((part) => {
        const cleanPart = cleanProductPart(part);
        const key = cleanPart.toUpperCase();
        if (!cleanPart || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function buildProductToCreateLabel(row: BulkPurchaseOrderRowAPI): string {
    const fabricName = cleanProductPart(row.suggested?.tela_nombre);
    const fabricReference = cleanProductPart(row.suggested?.tela_referencia);
    const fabricFromParts = uniqueProductParts([fabricName, fabricReference])
        .join(" ");
    const fabric = row.resolved?.tela_id
        ? cleanProductPart(row.suggested?.tela || row.tela)
        : fabricFromParts || cleanProductPart(row.suggested?.tela || row.tela);

    const label = uniqueProductParts([
        cleanProductPart(row.suggested?.base || row.base),
        cleanProductPart(row.suggested?.modelo || row.modelo),
        cleanProductPart(row.suggested?.referencia_1 || row.referencia_1),
        cleanProductPart(row.suggested?.referencia_2 || row.referencia_2),
        cleanProductPart(row.suggested?.referencia_3 || row.referencia_3),
        fabric,
    ]).join(" ");

    return label || row.product_name;
}

function ProductHomologationBadge({ row }: { row: BulkPurchaseOrderRowAPI }) {
    const productLabel = String(row.suggested?.producto ?? "").trim();

    if (row.resolved?.producto_id) {
        return (
            <div className="min-w-72 space-y-1">
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    Homologado
                </Badge>
                <div className="text-xs font-medium leading-snug text-foreground">
                    {productLabel || row.product_name}
                </div>
            </div>
        );
    }

    return (
        <div className="min-w-64 space-y-1">
            <Badge variant="outline" className="border-amber-300 text-amber-800">
                Se creara producto
            </Badge>
            <div className="text-xs leading-snug text-muted-foreground">
                {buildProductToCreateLabel(row)}
            </div>
        </div>
    );
}

export default function BulkPurchaseOrderUpload() {
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<BulkPurchaseOrderPreviewAPI | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [fieldModes, setFieldModes] = useState<Record<string, HomologationMode>>({});
    const [horizontalScroll, setHorizontalScroll] = useState(0);
    const [maxHorizontalScroll, setMaxHorizontalScroll] = useState(0);
    const tableScrollRef = useRef<HTMLDivElement | null>(null);
    const revalidationRunsRef = useRef<Record<number, number>>({});

    useEffect(() => {
        const tableScroller = tableScrollRef.current;
        if (!tableScroller) return;

        const updateScrollRange = () => {
            const maxScroll = Math.max(
                tableScroller.scrollWidth - tableScroller.clientWidth,
                0,
            );
            setMaxHorizontalScroll(maxScroll);
            setHorizontalScroll((current) => {
                const next = Math.min(current, maxScroll);
                if (tableScroller.scrollLeft !== next) {
                    tableScroller.scrollLeft = next;
                }
                return next;
            });
        };
        updateScrollRange();
        window.requestAnimationFrame(updateScrollRange);
        const updateTimer = window.setTimeout(updateScrollRange, 150);

        const resizeObserver =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(updateScrollRange)
                : null;
        resizeObserver?.observe(tableScroller);

        window.addEventListener("resize", updateScrollRange);
        return () => {
            window.clearTimeout(updateTimer);
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updateScrollRange);
        };
    }, [preview]);

    const handleHorizontalScrollChange = (value: number) => {
        setHorizontalScroll(value);
        if (tableScrollRef.current) {
            tableScrollRef.current.scrollLeft = value;
        }
    };

    const hasBlockingMissing = useMemo(
        () =>
            preview?.rows.some((row) =>
                row.missing.some((missing) =>
                    missing === "cliente" ||
                    (
                        ["base", "modelo", "tela"].includes(missing) &&
                        !isRowReadyForCommit(row)
                    ),
                ),
            ) ?? false,
        [preview],
    );

    const canCommit = Boolean(preview?.rows.length) && !hasBlockingMissing && !isCommitting;

    const previewSummary = useMemo(() => {
        const rows = preview?.rows ?? [];
        const ready = rows.filter(isRowReadyForCommit).length;
        return {
            total: rows.length,
            ready,
            pending: rows.length - ready,
        };
    }, [preview]);

    const getFieldKey = (rowNumber: number, field: HomologationField) =>
        `${rowNumber}:${field}`;

    const preparePreviewRows = (rows: BulkPurchaseOrderRowAPI[]) => {
        const nextModes: Record<string, HomologationMode> = {};
        const nextRows = rows.map((row) => {
            let nextRow = row;
            const hasResolvedProduct = Boolean(row.resolved?.producto_id);

            (["base", "modelo", "referencia_1", "referencia_2", "referencia_3", "tela"] as HomologationField[]).forEach(
                (field) => {
                    const fieldKey = getFieldKey(row.row_number, field);
                    const resolvedValue = nextRow.resolved?.[`${field}_id`];
                    const firstOption = nextRow.options?.[field]?.find(
                        (option) => option.suggested,
                    );
                    const isOptionalReference = field.startsWith("referencia_");
                    const hasText = String(nextRow.suggested?.[field] ?? "").trim().length > 0;
                    const mode: HomologationMode =
                        isOptionalReference && !resolvedValue && !hasText
                            ? "crear"
                            : resolvedValue || firstOption
                              ? "homologar"
                              : "crear";
                    nextModes[fieldKey] = mode;

                    if (
                        !hasResolvedProduct &&
                        !resolvedValue &&
                        firstOption &&
                        (!isOptionalReference || hasText)
                    ) {
                        nextRow = {
                            ...nextRow,
                            resolved: {
                                ...nextRow.resolved,
                                [`${field}_id`]: firstOption.id,
                                producto_id: null,
                            },
                            suggested: {
                                ...nextRow.suggested,
                                [field]: firstOption.label,
                            },
                            missing: Array.from(
                                new Set([
                                    ...nextRow.missing.filter(
                                        (missing) => missing !== "producto",
                                    ),
                                    "producto",
                                ]),
                            ),
                            status: "needs_approval",
                        };
                    }
                },
            );

            return nextRow;
        });

        setFieldModes(nextModes);
        return nextRows;
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error("Selecciona un archivo Excel");
            return;
        }

        setIsPreviewing(true);
        try {
            const result = await previewBulkPurchaseOrders(file);
            const rows = preparePreviewRows(result.rows);
            setPreview({ ...result, rows });
            toast.success("Archivo prevalidado", {
                description: `${result.summary.total} filas encontradas`,
            });
        } catch (error) {
            setPreview(null);
            toast.error("No se pudo prevalidar", {
                description:
                    error instanceof Error ? error.message : "Error leyendo el archivo",
            });
        } finally {
            setIsPreviewing(false);
        }
    };

    const revalidateConfiguredProduct = async (row: BulkPurchaseOrderRowAPI) => {
        const runNumber = (revalidationRunsRef.current[row.row_number] ?? 0) + 1;
        revalidationRunsRef.current[row.row_number] = runNumber;

        try {
            const revalidatedRow = await revalidateBulkPurchaseOrderProduct(row);
            if (revalidationRunsRef.current[row.row_number] !== runNumber) {
                return;
            }
            setPreview((current) => {
                if (!current) return current;
                return {
                    ...current,
                    rows: current.rows.map((currentRow) =>
                        currentRow.row_number === row.row_number
                            ? {
                                  ...currentRow,
                                  ...revalidatedRow,
                                  options: currentRow.options,
                              }
                            : currentRow,
                    ),
                };
            });
        } catch {
            // La revalidacion no debe bloquear la edicion manual de la fila.
        }
    };

    const updateRow = (
        rowNumber: number,
        updater: (row: BulkPurchaseOrderRowAPI) => BulkPurchaseOrderRowAPI,
        options: { revalidateProduct?: boolean } = {},
    ) => {
        const sourceRow = preview?.rows.find((row) => row.row_number === rowNumber);
        const rowToRevalidate = sourceRow ? updater(sourceRow) : null;
        setPreview((current) => {
            if (!current) return current;
            const rows = current.rows.map((row) => {
                if (row.row_number !== rowNumber) return row;
                return rowToRevalidate ?? updater(row);
            });
            return {
                ...current,
                rows,
            };
        });
        if (options.revalidateProduct) {
            window.setTimeout(() => {
                if (rowToRevalidate) {
                    void revalidateConfiguredProduct(rowToRevalidate);
                }
            }, 0);
        }
    };

    const handleResolvedChange = (
        row: BulkPurchaseOrderRowAPI,
        field: HomologationField,
        rawValue: string,
    ) => {
        const selectedOption = row.options?.[field]?.find(
            (option) => String(option.id) === rawValue,
        );
        const isClearingOptionalReference =
            field.startsWith("referencia_") && rawValue === "";

        updateRow(row.row_number, (current) => ({
            ...current,
            resolved: {
                ...current.resolved,
                [`${field}_id`]: selectedOption ? selectedOption.id : null,
                producto_id: null,
            },
            suggested: {
                ...current.suggested,
                [field]: isClearingOptionalReference
                    ? ""
                    : selectedOption?.label ?? current.suggested?.[field] ?? "",
                producto: "",
                ...(field.startsWith("referencia_")
                    ? { [`${field}_empty`]: isClearingOptionalReference ? "true" : "false" }
                    : {}),
            },
            missing: Array.from(
                new Set([
                    ...current.missing.filter((missing) => missing !== "producto"),
                    "producto",
                ]),
            ),
            status: "needs_approval",
        }), { revalidateProduct: true });
    };

    const handleModeChange = (
        row: BulkPurchaseOrderRowAPI,
        field: HomologationField,
        mode: HomologationMode,
    ) => {
        const fieldKey = getFieldKey(row.row_number, field);
        setFieldModes((current) => ({
            ...current,
            [fieldKey]: mode,
        }));

        if (mode === "crear") {
            updateRow(row.row_number, (current) => ({
                ...current,
                resolved: {
                    ...current.resolved,
                    [`${field}_id`]: null,
                    producto_id: null,
                },
                suggested: {
                    ...current.suggested,
                    producto: "",
                },
                missing: Array.from(
                    new Set([
                        ...current.missing.filter((missing) => missing !== "producto"),
                        ...(field.startsWith("referencia_") ? [] : [field]),
                        "producto",
                    ]),
                ),
                status: "needs_approval",
            }), { revalidateProduct: true });
            return;
        }

        const firstOption = row.options?.[field]?.[0];
        if (firstOption) {
            handleResolvedChange(row, field, String(firstOption.id));
        }
    };

    const handleSuggestedChange = (
        rowNumber: number,
        field: string,
        value: string,
    ) => {
        updateRow(rowNumber, (current) => ({
            ...current,
            resolved: {
                ...current.resolved,
                ...(field in MISSING_LABELS ? { [`${field}_id`]: null } : {}),
                producto_id: null,
            },
            suggested: {
                ...current.suggested,
                [field]: value,
                producto: "",
                ...(field.startsWith("referencia_")
                    ? { [`${field}_empty`]: value.trim() ? "false" : current.suggested?.[`${field}_empty`] ?? "false" }
                    : {}),
            },
            missing: Array.from(
                new Set([
                    ...current.missing.filter((missing) => missing !== "producto"),
                    ...(field.startsWith("referencia_")
                        ? []
                        : [field in MISSING_LABELS ? field : "tela"]),
                    "producto",
                ]),
            ),
            status: "needs_approval",
        }), { revalidateProduct: true });
    };

    const handleFabricUnitChange = (
        row: BulkPurchaseOrderRowAPI,
        rawValue: string,
    ) => {
        const selectedOption = row.options?.tela_unidad_medida?.find(
            (option) => String(option.id) === rawValue,
        );
        updateRow(row.row_number, (current) => ({
            ...current,
            resolved: {
                ...current.resolved,
                tela_unidad_medida_id: selectedOption ? selectedOption.id : null,
                producto_id: null,
            },
            suggested: {
                ...current.suggested,
                tela_unidad_medida: selectedOption?.label ?? "",
                producto: "",
            },
            missing: Array.from(
                new Set([
                    ...current.missing.filter((missing) => missing !== "producto"),
                    "tela",
                    "producto",
                ]),
            ),
            status: "needs_approval",
        }), { revalidateProduct: true });
    };

    const handleOptionalEmptyChange = (
        row: BulkPurchaseOrderRowAPI,
        field: HomologationField,
        checked: boolean,
    ) => {
        if (!field.startsWith("referencia_")) return;

        updateRow(row.row_number, (current) => ({
            ...current,
            resolved: {
                ...current.resolved,
                [`${field}_id`]: null,
                producto_id: null,
            },
            suggested: {
                ...current.suggested,
                [field]: checked ? "" : current.suggested?.[field] ?? "",
                [`${field}_empty`]: checked ? "true" : "false",
                producto: "",
            },
            missing: Array.from(
                new Set([
                    ...current.missing.filter((missing) => missing !== "producto"),
                    "producto",
                ]),
            ),
            status: "needs_approval",
        }), { revalidateProduct: true });
    };

    const renderHomologationControl = (
        row: BulkPurchaseOrderRowAPI,
        field: HomologationField,
    ) => {
        const resolvedValue = row.resolved?.[`${field}_id`];
        const options = row.options?.[field] ?? [];
        const suggestedValue = String(row.suggested?.[field] ?? "");
        const isOptionalReference = field.startsWith("referencia_");
        const isEmptyConfirmed =
            isOptionalReference && String(row.suggested?.[`${field}_empty`] ?? "") === "true";
        const suggestedOptions = options.filter((option) => option.suggested);
        const otherOptions = options.filter((option) => !option.suggested);
        const fieldKey = getFieldKey(row.row_number, field);
        const mode = fieldModes[fieldKey] ?? (resolvedValue ? "homologar" : "crear");

        return (
            <div className="flex min-w-56 flex-col gap-2">
                <select
                    value={mode}
                    onChange={(event) =>
                        handleModeChange(
                            row,
                            field,
                            event.target.value as HomologationMode,
                        )
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                    <option value="homologar">Homologar</option>
                    <option value="crear">Crear con texto</option>
                </select>
                {mode === "homologar" ? (
                    <select
                        value={resolvedValue ? String(resolvedValue) : ""}
                        onChange={(event) =>
                            handleResolvedChange(row, field, event.target.value)
                        }
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                        {options.length === 0 && (
                            <option value="">Sin opciones sugeridas</option>
                        )}
                        {isOptionalReference && (
                            <option value="">Dejar vacio</option>
                        )}
                        {suggestedOptions.length > 0 && (
                            <optgroup label="Sugeridas">
                                {suggestedOptions.map((option) => (
                                    <option key={String(option.id)} value={String(option.id)}>
                                        {option.label}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        {otherOptions.length > 0 && (
                            <optgroup label="Catalogo">
                                {otherOptions.map((option) => (
                                    <option key={String(option.id)} value={String(option.id)}>
                                        {option.label}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                ) : field === "tela" ? (
                    <div className="grid gap-2">
                        <input
                            value={String(row.suggested?.tela_nombre ?? "")}
                            onChange={(event) =>
                                handleSuggestedChange(
                                    row.row_number,
                                    "tela_nombre",
                                    event.target.value,
                                )
                            }
                            placeholder="Nombre"
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        />
                        <input
                            value={String(row.suggested?.tela_referencia ?? "")}
                            onChange={(event) =>
                                handleSuggestedChange(
                                    row.row_number,
                                    "tela_referencia",
                                    event.target.value,
                                )
                            }
                            placeholder="Referencia"
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        />
                        <select
                            value={
                                row.resolved?.tela_unidad_medida_id
                                    ? String(row.resolved.tela_unidad_medida_id)
                                    : ""
                            }
                            onChange={(event) =>
                                handleFabricUnitChange(row, event.target.value)
                            }
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        >
                            <option value="">Unidad de medida</option>
                            {(row.options?.tela_unidad_medida ?? []).map((option) => (
                                <option key={String(option.id)} value={String(option.id)}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {isOptionalReference && (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={isEmptyConfirmed}
                                    onChange={(event) =>
                                        handleOptionalEmptyChange(
                                            row,
                                            field,
                                            event.target.checked,
                                        )
                                    }
                                />
                                Dejar vacio
                            </label>
                        )}
                        <input
                            value={suggestedValue}
                            onChange={(event) =>
                                handleSuggestedChange(row.row_number, field, event.target.value)
                            }
                            placeholder={`Crear ${MISSING_LABELS[field]}`}
                            disabled={isEmptyConfirmed}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                        />
                    </div>
                )}
            </div>
        );
    };

    const handleCommit = async () => {
        if (!preview) return;

        setIsCommitting(true);
        try {
            const result = await commitBulkPurchaseOrders({
                rows: preview.rows,
                createMissing: true,
            });
            toast.success("Carga masiva completada", {
                description: `${result.created_orders} ordenes, ${result.created_items} items creados`,
            });
            setPreview(null);
            setFile(null);
        } catch (error) {
            toast.error("No se pudo cargar", {
                description:
                    error instanceof Error ? error.message : "Error guardando la carga masiva",
            });
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/80 bg-card/80 backdrop-blur">
                <div className="container mx-auto max-w-6xl px-4 py-5">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/app/forms")}
                            className="text-foreground hover:bg-muted/60"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                        <div className="h-8 w-px bg-border" aria-hidden />
                        <div>
                            <h1 className="text-2xl font-semibold leading-tight text-foreground">
                                Carga masiva
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Ordenes de compra e items desde Excel
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-6xl px-4 py-8">
                <Card className="border border-border/80 bg-card shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                            <FileSpreadsheet className="h-5 w-5" />
                            Archivo de ordenes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <input
                                type="file"
                                accept=".xlsx"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                onChange={(event) => {
                                    setFile(event.target.files?.[0] ?? null);
                                    setPreview(null);
                                }}
                            />
                            <Button
                                type="button"
                                onClick={handlePreview}
                                disabled={!file || isPreviewing}
                                className="sm:w-auto"
                            >
                                {isPreviewing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                )}
                                Prevalidar
                            </Button>
                        </div>

                        {preview && (
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-md border border-border bg-muted/20 p-3">
                                    <div className="text-xs text-muted-foreground">Filas</div>
                                    <div className="text-2xl font-semibold">{previewSummary.total}</div>
                                </div>
                                <div className="rounded-md border border-border bg-muted/20 p-3">
                                    <div className="text-xs text-muted-foreground">Finalizadas</div>
                                    <div className="text-2xl font-semibold text-emerald-700">
                                        {previewSummary.ready}
                                    </div>
                                </div>
                                <div className="rounded-md border border-border bg-muted/20 p-3">
                                    <div className="text-xs text-muted-foreground">Pendientes</div>
                                    <div className="text-2xl font-semibold text-amber-700">
                                        {previewSummary.pending}
                                    </div>
                                </div>
                            </div>
                        )}

                        {hasBlockingMissing && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Faltan datos base</AlertTitle>
                                <AlertDescription>
                                    El cliente debe existir. Para Base, Modelo y Tela
                                    puedes homologar una opcion existente o crear con texto.
                                </AlertDescription>
                            </Alert>
                        )}

                        {preview && preview.rows.length > 0 && (
                            <div className="space-y-4">
                                <div
                                    ref={tableScrollRef}
                                    onScroll={(event) =>
                                        setHorizontalScroll(
                                            event.currentTarget.scrollLeft,
                                        )
                                    }
                                    className="max-h-[calc(100vh-390px)] overflow-auto rounded-md border border-border"
                                >
                                    <Table className="min-w-[2020px]">
                                        <TableHeader className="sticky top-0 z-10 bg-card">
                                            <TableRow>
                                                <TableHead colSpan={13} className="bg-card p-3">
                                                    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 shadow-sm">
                                                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                                            Scroll horizontal
                                                        </span>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={maxHorizontalScroll}
                                                            value={horizontalScroll}
                                                            disabled={maxHorizontalScroll === 0}
                                                            onChange={(event) =>
                                                                handleHorizontalScrollChange(
                                                                    Number(event.target.value),
                                                                )
                                                            }
                                                            aria-label="Desplazamiento horizontal"
                                                            className="block h-4 min-w-0 flex-1 cursor-ew-resize accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                                                        />
                                                    </div>
                                                </TableHead>
                                            </TableRow>
                                            <TableRow>
                                                <TableHead className="min-w-16">Fila</TableHead>
                                                <TableHead className="min-w-28">Estado</TableHead>
                                                <TableHead className="min-w-44">Cliente</TableHead>
                                                <TableHead className="min-w-64">Nombre</TableHead>
                                                <TableHead className="min-w-80">Producto homologado</TableHead>
                                                <TableHead>Base</TableHead>
                                                <TableHead>Modelo</TableHead>
                                                <TableHead>Referencia 1</TableHead>
                                                <TableHead>Referencia 2</TableHead>
                                                <TableHead>Referencia 3</TableHead>
                                                <TableHead>Tela</TableHead>
                                                <TableHead className="min-w-44 px-5">OC cliente</TableHead>
                                                <TableHead className="min-w-28 px-5 text-right">Cantidad</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.rows.map((row) => (
                                                <TableRow key={`${row.row_number}-${row.oc_interno}`}>
                                                    <TableCell>{row.row_number}</TableCell>
                                                    <TableCell>
                                                        <MissingBadges row={row} />
                                                    </TableCell>
                                                    <TableCell>{row.cliente}</TableCell>
                                                    <TableCell>{row.product_name}</TableCell>
                                                    <TableCell>
                                                        <ProductHomologationBadge row={row} />
                                                    </TableCell>
                                                    <TableCell>{renderHomologationControl(row, "base")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "modelo")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "referencia_1")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "referencia_2")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "referencia_3")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "tela")}</TableCell>
                                                    <TableCell className="px-5">{row.oc_cliente}</TableCell>
                                                    <TableCell className="px-5 text-right font-medium">
                                                        {row.cantidad}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Al continuar se crean las ordenes aprobadas, las telas y
                                        productos faltantes, y luego los items con item legado
                                        consecutivo.
                                    </p>
                                    <Button
                                        type="button"
                                        onClick={handleCommit}
                                        disabled={!canCommit}
                                        className="sm:w-auto"
                                    >
                                        {isCommitting ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                        )}
                                        Continuar con items
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

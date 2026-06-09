import { useMemo, useState } from "react";
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

type HomologationField = "base" | "modelo" | "referencia" | "tela";
type HomologationMode = "homologar" | "crear";

const MISSING_LABELS: Record<string, string> = {
    cliente: "Cliente",
    base: "Base",
    modelo: "Modelo",
    referencia: "Referencia",
    tela: "Tela",
    producto: "Producto",
};

function isRowReadyForCommit(row: BulkPurchaseOrderRowAPI): boolean {
    if (row.missing.includes("cliente")) {
        return false;
    }

    const hasBaseData = (["base", "modelo", "referencia"] as HomologationField[]).every(
        (field) =>
            Boolean(row.resolved?.[`${field}_id`]) ||
            String(row.suggested?.[field] ?? "").trim().length > 0,
    );
    const hasFabricData =
        Boolean(row.resolved?.tela_id) ||
        (
            String(row.suggested?.tela_nombre ?? "").trim().length > 0 &&
            String(row.suggested?.tela_referencia ?? "").trim().length > 0 &&
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

export default function BulkPurchaseOrderUpload() {
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<BulkPurchaseOrderPreviewAPI | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [fieldModes, setFieldModes] = useState<Record<string, HomologationMode>>({});

    const hasBlockingMissing = useMemo(
        () =>
            preview?.rows.some((row) =>
                row.missing.some((missing) =>
                    missing === "cliente" ||
                    (
                        ["base", "modelo", "referencia", "tela"].includes(missing) &&
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

            (["base", "modelo", "referencia", "tela"] as HomologationField[]).forEach(
                (field) => {
                    const fieldKey = getFieldKey(row.row_number, field);
                    const resolvedValue = nextRow.resolved?.[`${field}_id`];
                    const firstOption = nextRow.options?.[field]?.[0];
                    const mode: HomologationMode =
                        resolvedValue || firstOption ? "homologar" : "crear";
                    nextModes[fieldKey] = mode;

                    if (!resolvedValue && firstOption) {
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

    const updateRow = (
        rowNumber: number,
        updater: (row: BulkPurchaseOrderRowAPI) => BulkPurchaseOrderRowAPI,
    ) => {
        setPreview((current) => {
            if (!current) return current;
            const rows = current.rows.map((row) =>
                row.row_number === rowNumber ? updater(row) : row,
            );
            return {
                ...current,
                rows,
            };
        });
    };

    const handleResolvedChange = (
        row: BulkPurchaseOrderRowAPI,
        field: HomologationField,
        rawValue: string,
    ) => {
        const selectedOption = row.options?.[field]?.find(
            (option) => String(option.id) === rawValue,
        );

        updateRow(row.row_number, (current) => ({
            ...current,
            resolved: {
                ...current.resolved,
                [`${field}_id`]: selectedOption ? selectedOption.id : null,
                producto_id: null,
            },
            suggested: {
                ...current.suggested,
                [field]: selectedOption?.label ?? current.suggested?.[field] ?? "",
            },
            missing: Array.from(
                new Set([
                    ...current.missing.filter((missing) => missing !== "producto"),
                    "producto",
                ]),
            ),
            status: "needs_approval",
        }));
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
                missing: Array.from(
                    new Set([
                        ...current.missing.filter((missing) => missing !== "producto"),
                        field,
                        "producto",
                    ]),
                ),
                status: "needs_approval",
            }));
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
            },
            missing: Array.from(
                new Set([
                    ...current.missing.filter((missing) => missing !== "producto"),
                    field in MISSING_LABELS ? field : "tela",
                    "producto",
                ]),
            ),
            status: "needs_approval",
        }));
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
            },
            missing: Array.from(
                new Set([
                    ...current.missing.filter((missing) => missing !== "producto"),
                    "tela",
                    "producto",
                ]),
            ),
            status: "needs_approval",
        }));
    };

    const renderHomologationControl = (
        row: BulkPurchaseOrderRowAPI,
        field: HomologationField,
    ) => {
        const resolvedValue = row.resolved?.[`${field}_id`];
        const options = row.options?.[field] ?? [];
        const suggestedValue = String(row.suggested?.[field] ?? "");
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
                        {options.map((option) => (
                            <option key={String(option.id)} value={String(option.id)}>
                                {option.label}
                            </option>
                        ))}
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
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                                handleSuggestedChange(row.row_number, "tela_nombre", ".")
                            }
                        >
                            .
                        </Button>
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
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                                handleSuggestedChange(row.row_number, "tela_referencia", ".")
                            }
                        >
                            .
                        </Button>
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
                    <div className="flex gap-2">
                        <input
                            value={suggestedValue}
                            onChange={(event) =>
                                handleSuggestedChange(row.row_number, field, event.target.value)
                            }
                            placeholder={`Crear ${MISSING_LABELS[field]}`}
                            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                                handleSuggestedChange(row.row_number, field, ".")
                            }
                        >
                            .
                        </Button>
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
                                    El cliente debe existir. Para Base, Modelo, Referencia y Tela
                                    puedes homologar una opcion existente o crear con texto.
                                </AlertDescription>
                            </Alert>
                        )}

                        {preview && preview.rows.length > 0 && (
                            <div className="space-y-4">
                                <div className="max-h-[calc(100vh-360px)] overflow-auto rounded-md border border-border">
                                    <Table className="min-w-[1680px]">
                                        <TableHeader className="sticky top-0 z-10 bg-card">
                                            <TableRow>
                                                <TableHead>Fila</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Nombre</TableHead>
                                                <TableHead>Base</TableHead>
                                                <TableHead>Modelo</TableHead>
                                                <TableHead>Referencia</TableHead>
                                                <TableHead>Tela</TableHead>
                                                <TableHead>OC interno</TableHead>
                                                <TableHead>OC cliente</TableHead>
                                                <TableHead>Cantidad</TableHead>
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
                                                    <TableCell>{renderHomologationControl(row, "base")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "modelo")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "referencia")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "tela")}</TableCell>
                                                    <TableCell>{row.oc_interno}</TableCell>
                                                    <TableCell>{row.oc_cliente}</TableCell>
                                                    <TableCell>{row.cantidad}</TableCell>
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

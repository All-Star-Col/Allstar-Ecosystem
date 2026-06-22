import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    FileSpreadsheet,
    Loader2,
    RotateCcw,
    Save,
    Trash2,
    Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
    commitBulkOrderProcess,
    commitBulkPurchaseOrders,
    previewBulkOrderProcess,
    previewBulkPurchaseOrders,
    revalidateBulkOrderProcessRow,
    revalidateBulkPurchaseOrderProduct,
} from "../api";
import type {
    BulkOrderProcessPreviewAPI,
    BulkOrderProcessRowAPI,
    BulkPurchaseOrderPreviewAPI,
    BulkPurchaseOrderRowAPI,
} from "../api";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
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

const HOMOLOGATION_FIELDS: HomologationField[] = [
    "base",
    "modelo",
    "referencia_1",
    "referencia_2",
    "referencia_3",
    "tela",
];

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

const BULK_TABLE_COLUMNS = [
    72,
    130,
    200,
    360,
    280,
    380,
    280,
    280,
    280,
    280,
    280,
    380,
    280,
    220,
    140,
    180,
] as const;
const BULK_TABLE_WIDTH = BULK_TABLE_COLUMNS.reduce(
    (total, width) => total + width,
    0,
);
const BULK_DRAFT_STORAGE_KEY = "allstar.forms.bulkPurchaseOrders.draft.v1";
const BULK_DRAFT_VERSION = 1;
const ORDER_PROCESS_COLUMNS = [72, 130, 150, 140, 180, 180, 220, 320, 180] as const;
const ORDER_PROCESS_TABLE_WIDTH = ORDER_PROCESS_COLUMNS.reduce(
    (total, width) => total + width,
    0,
);

type BulkSection = "purchase-orders" | "order-process";

type BulkDraftInfo = {
    savedAt: string;
    fileName: string;
    rows: number;
};

type BulkPurchaseOrderDraft = BulkDraftInfo & {
    version: number;
    preview: BulkPurchaseOrderPreviewAPI;
    fieldModes: Record<string, HomologationMode>;
    finalizedRows: number[];
};

function readBulkDraft(): BulkPurchaseOrderDraft | null {
    if (typeof window === "undefined") return null;

    try {
        const rawDraft = window.localStorage.getItem(BULK_DRAFT_STORAGE_KEY);
        if (!rawDraft) return null;

        const draft = JSON.parse(rawDraft) as Partial<BulkPurchaseOrderDraft>;
        if (
            draft.version !== BULK_DRAFT_VERSION ||
            !draft.preview ||
            !Array.isArray(draft.preview.rows)
        ) {
            return null;
        }

        return {
            version: BULK_DRAFT_VERSION,
            savedAt: String(draft.savedAt ?? ""),
            fileName: String(draft.fileName ?? ""),
            rows: Number(draft.rows ?? draft.preview.rows.length),
            preview: draft.preview,
            fieldModes: draft.fieldModes ?? {},
            finalizedRows: Array.isArray(draft.finalizedRows)
                ? draft.finalizedRows.map(Number).filter(Number.isFinite)
                : [],
        };
    } catch {
        return null;
    }
}

function formatDraftDate(value: string): string {
    if (!value) return "";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return "";
    return parsedDate.toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
    });
}

function MissingBadges({ isFinalized }: { isFinalized: boolean }) {
    return (
        <Badge
            variant={isFinalized ? "secondary" : "outline"}
            className={
                isFinalized
                    ? "bg-emerald-100 text-emerald-800"
                    : "border-amber-300 text-amber-800"
            }
        >
            {isFinalized ? "Finalizada" : "Pendiente"}
        </Badge>
    );
}

function cleanProductPart(value: unknown): string {
    return String(value ?? "").trim();
}

function normalizeSearchText(value: unknown): string {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function hasConfiguredValue(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim() !== "";
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
            <div className="min-w-0 max-w-full space-y-1 whitespace-normal break-words">
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    Homologado
                </Badge>
                <div className="whitespace-normal break-words text-xs font-medium leading-snug text-foreground">
                    {productLabel || row.product_name}
                </div>
            </div>
        );
    }

    return (
        <div className="min-w-0 max-w-full space-y-1 whitespace-normal break-words">
            <Badge variant="outline" className="border-amber-300 text-amber-800">
                Se creara producto
            </Badge>
            <div className="whitespace-normal break-words text-xs leading-snug text-muted-foreground">
                {buildProductToCreateLabel(row)}
            </div>
        </div>
    );
}

function mergeRevalidatedRow(
    currentRow: BulkPurchaseOrderRowAPI,
    requestedRow: BulkPurchaseOrderRowAPI,
    revalidatedRow: BulkPurchaseOrderRowAPI,
): BulkPurchaseOrderRowAPI {
    const nextResolved = { ...(revalidatedRow.resolved ?? {}) };
    const nextSuggested = { ...(revalidatedRow.suggested ?? {}) };
    let productConflict = false;

    HOMOLOGATION_FIELDS.forEach((field) => {
        const resolvedKey = `${field}_id`;
        const requestedResolved = requestedRow.resolved?.[resolvedKey];
        const revalidatedResolved = revalidatedRow.resolved?.[resolvedKey];
        const requestedSuggested = requestedRow.suggested?.[field];
        const shouldPreserve =
            hasConfiguredValue(requestedResolved) ||
            hasConfiguredValue(requestedSuggested);

        if (!shouldPreserve) return;

        if (
            hasConfiguredValue(requestedResolved) &&
            hasConfiguredValue(revalidatedResolved) &&
            String(requestedResolved) !== String(revalidatedResolved)
        ) {
            productConflict = true;
        }

        nextResolved[resolvedKey] = hasConfiguredValue(requestedResolved)
            ? requestedResolved
            : null;
        nextSuggested[field] = hasConfiguredValue(requestedSuggested)
            ? requestedSuggested
            : "";
    });

    (["tela_nombre", "tela_referencia", "tela_unidad_medida"] as const).forEach(
        (field) => {
            const requestedValue = requestedRow.suggested?.[field];
            if (hasConfiguredValue(requestedValue)) {
                nextSuggested[field] = requestedValue;
            }
        },
    );

    let nextMissing = revalidatedRow.missing;
    let nextStatus = revalidatedRow.status;
    if (productConflict) {
        nextResolved.producto_id = null;
        nextSuggested.producto = "";
        nextMissing = Array.from(new Set([...(nextMissing ?? []), "producto"]));
        nextStatus = "needs_approval";
    }

    return {
        ...currentRow,
        ...revalidatedRow,
        resolved: nextResolved,
        suggested: nextSuggested,
        options: currentRow.options,
        missing: nextMissing,
        status: nextStatus,
    };
}

export default function BulkPurchaseOrderUpload() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState<BulkSection>("purchase-orders");
    const [file, setFile] = useState<File | null>(null);
    const [sourceFileName, setSourceFileName] = useState("");
    const [preview, setPreview] = useState<BulkPurchaseOrderPreviewAPI | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [fieldModes, setFieldModes] = useState<Record<string, HomologationMode>>({});
    const [finalizedRows, setFinalizedRows] = useState<Set<number>>(new Set());
    const [draftInfo, setDraftInfo] = useState<BulkDraftInfo | null>(null);
    const [homologationSearches, setHomologationSearches] = useState<Record<string, string>>({});
    const revalidationRunsRef = useRef<Record<number, number>>({});
    const [processFile, setProcessFile] = useState<File | null>(null);
    const [processSourceFileName, setProcessSourceFileName] = useState("");
    const [processPreview, setProcessPreview] = useState<BulkOrderProcessPreviewAPI | null>(null);
    const [isProcessPreviewing, setIsProcessPreviewing] = useState(false);
    const [isProcessCommitting, setIsProcessCommitting] = useState(false);
    const [processRowsValidating, setProcessRowsValidating] = useState<Set<number>>(new Set());

    const isRowFinalized = (row: BulkPurchaseOrderRowAPI) =>
        finalizedRows.has(row.row_number);

    const hasBlockingMissing = useMemo(
        () =>
            preview?.rows.some((row) =>
                row.missing.some((missing) => missing === "cliente"),
            ) ?? false,
        [preview],
    );

    const allRowsFinalized =
        Boolean(preview?.rows.length) &&
        (preview?.rows ?? []).every((row) => isRowFinalized(row));

    const canCommit =
        Boolean(preview?.rows.length) &&
        allRowsFinalized &&
        !isCommitting;

    const previewSummary = useMemo(() => {
        const rows = preview?.rows ?? [];
        const ready = rows.filter((row) => isRowFinalized(row)).length;
        return {
            total: rows.length,
            ready,
            pending: rows.length - ready,
        };
    }, [preview, finalizedRows]);

    const processSummary = useMemo(() => {
        const rows = processPreview?.rows ?? [];
        const activeRows = rows.filter((row) => row.status !== "omitted");
        return {
            total: rows.length,
            ready: activeRows.filter((row) => row.status === "ready").length,
            invalid: activeRows.filter((row) => row.status !== "ready").length,
            omitted: rows.filter((row) => row.status === "omitted").length,
        };
    }, [processPreview]);

    const canCommitProcess =
        Boolean(processPreview?.rows.length) &&
        processSummary.invalid === 0 &&
        processSummary.ready > 0 &&
        !isProcessCommitting;

    const getFieldKey = (rowNumber: number, field: HomologationField) =>
        `${rowNumber}:${field}`;

    const refreshDraftInfo = () => {
        const draft = readBulkDraft();
        setDraftInfo(
            draft
                ? {
                      savedAt: draft.savedAt,
                      fileName: draft.fileName,
                      rows: draft.rows,
                  }
                : null,
        );
    };

    const saveDraft = (options: { showToast?: boolean } = {}) => {
        if (!preview) {
            if (options.showToast) {
                toast.error("No hay avance para guardar");
            }
            return;
        }

        const savedAt = new Date().toISOString();
        const draft: BulkPurchaseOrderDraft = {
            version: BULK_DRAFT_VERSION,
            savedAt,
            fileName: sourceFileName || file?.name || "",
            rows: preview.rows.length,
            preview,
            fieldModes,
            finalizedRows: Array.from(finalizedRows),
        };

        try {
            window.localStorage.setItem(
                BULK_DRAFT_STORAGE_KEY,
                JSON.stringify(draft),
            );
            setDraftInfo({
                savedAt,
                fileName: draft.fileName,
                rows: draft.rows,
            });
            if (options.showToast) {
                toast.success("Avance guardado", {
                    description: draft.fileName || `${draft.rows} filas guardadas`,
                });
            }
        } catch {
            if (options.showToast) {
                toast.error("No se pudo guardar el avance en este navegador");
            }
        }
    };

    const restoreDraft = () => {
        const draft = readBulkDraft();
        if (!draft) {
            refreshDraftInfo();
            toast.error("No hay un avance guardado para cargar");
            return;
        }

        setFile(null);
        setSourceFileName(draft.fileName);
        setPreview(draft.preview);
        setFieldModes(draft.fieldModes);
        setHomologationSearches({});
        setFinalizedRows(new Set(draft.finalizedRows));
        setDraftInfo({
            savedAt: draft.savedAt,
            fileName: draft.fileName,
            rows: draft.rows,
        });
        toast.success("Avance cargado", {
            description: `${draft.rows} filas restauradas`,
        });
    };

    const clearDraft = () => {
        window.localStorage.removeItem(BULK_DRAFT_STORAGE_KEY);
        setDraftInfo(null);
        toast.success("Borrador descartado");
    };

    useEffect(() => {
        refreshDraftInfo();
    }, []);

    useEffect(() => {
        if (!preview) return;

        const timeoutId = window.setTimeout(() => {
            saveDraft();
        }, 400);

        return () => window.clearTimeout(timeoutId);
    }, [preview, fieldModes, finalizedRows, sourceFileName]);

    const preparePreviewRows = (rows: BulkPurchaseOrderRowAPI[]) => {
        const nextModes: Record<string, HomologationMode> = {};
        const nextRows = rows.map((row) => {
            let nextRow = row;
            const hasResolvedProduct = Boolean(row.resolved?.producto_id);

            HOMOLOGATION_FIELDS.forEach(
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

            return {
                ...nextRow,
                status: "needs_approval" as const,
            };
        });

        setFieldModes(nextModes);
        setFinalizedRows(new Set());
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
            setSourceFileName(file.name);
            setHomologationSearches({});
            setPreview({ ...result, rows });
            toast.success("Archivo prevalidado", {
                description: `${result.summary.total} filas encontradas`,
            });
        } catch (error) {
            setPreview(null);
            setFinalizedRows(new Set());
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
                            ? mergeRevalidatedRow(currentRow, row, revalidatedRow)
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
        setFinalizedRows((current) => {
            if (!current.has(rowNumber)) return current;
            const next = new Set(current);
            next.delete(rowNumber);
            return next;
        });
        const sourceRow = preview?.rows.find((row) => row.row_number === rowNumber);
        const rowToRevalidate = sourceRow
            ? { ...updater(sourceRow), status: "needs_approval" as const }
            : null;
        setPreview((current) => {
            if (!current) return current;
            const rows = current.rows.map((row) => {
                if (row.row_number !== rowNumber) return row;
                return rowToRevalidate ?? { ...updater(row), status: "needs_approval" as const };
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
        const isClearingField = rawValue === "";

        updateRow(row.row_number, (current) => ({
            ...current,
            resolved: {
                ...current.resolved,
                [`${field}_id`]: selectedOption ? selectedOption.id : null,
                producto_id: null,
            },
            suggested: {
                ...current.suggested,
                [field]: isClearingField
                    ? ""
                    : selectedOption?.label ?? current.suggested?.[field] ?? "",
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

    const handleFinalizeRow = (row: BulkPurchaseOrderRowAPI) => {
        setPreview((current) => {
            if (!current) return current;
            return {
                ...current,
                rows: current.rows.map((currentRow) =>
                    currentRow.row_number === row.row_number
                        ? { ...currentRow, status: "ready" as const }
                        : currentRow,
                ),
            };
        });
        setFinalizedRows((current) => {
            const next = new Set(current);
            next.add(row.row_number);
            return next;
        });
    };

    const renderHomologationControl = (
        row: BulkPurchaseOrderRowAPI,
        field: HomologationField,
    ) => {
        const resolvedValue = row.resolved?.[`${field}_id`];
        const options = row.options?.[field] ?? [];
        const suggestedValue = String(row.suggested?.[field] ?? "");
        const suggestedOptions = options.filter((option) => option.suggested);
        const otherOptions = options.filter((option) => !option.suggested);
        const fieldKey = getFieldKey(row.row_number, field);
        const mode = fieldModes[fieldKey] ?? (resolvedValue ? "homologar" : "crear");
        const searchKey = `${fieldKey}:search`;
        const searchValue = homologationSearches[searchKey] ?? "";
        const normalizedSearch = normalizeSearchText(searchValue);
        const selectedOptionId = resolvedValue ? String(resolvedValue) : "";
        const filterOption = (option: { id: string | number; label: string }) => {
            if (selectedOptionId && String(option.id) === selectedOptionId) {
                return true;
            }
            if (!normalizedSearch) {
                return true;
            }
            return normalizeSearchText(option.label).includes(normalizedSearch);
        };
        const filteredSuggestedOptions = suggestedOptions.filter(filterOption);
        const filteredOtherOptions = otherOptions.filter(filterOption);
        const hasFilteredOptions =
            filteredSuggestedOptions.length > 0 || filteredOtherOptions.length > 0;

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
                    <div className="grid gap-2">
                        <input
                            value={searchValue}
                            onChange={(event) =>
                                setHomologationSearches((current) => ({
                                    ...current,
                                    [searchKey]: event.target.value,
                                }))
                            }
                            placeholder={`Buscar ${MISSING_LABELS[field].toLowerCase()}...`}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                        />
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
                            {options.length > 0 && (
                                <option value="">Sin seleccionar</option>
                            )}
                            {options.length > 0 && !hasFilteredOptions && (
                                <option value="__no_results" disabled>
                                    Sin resultados
                                </option>
                            )}
                            {filteredSuggestedOptions.length > 0 && (
                                <optgroup label="Sugeridas">
                                    {filteredSuggestedOptions.map((option) => (
                                        <option key={String(option.id)} value={String(option.id)}>
                                            {option.label}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {filteredOtherOptions.length > 0 && (
                                <optgroup label="Catalogo">
                                    {filteredOtherOptions.map((option) => (
                                        <option key={String(option.id)} value={String(option.id)}>
                                            {option.label}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
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
                        <div className="rounded-md border border-input bg-muted px-2 py-1 text-xs text-muted-foreground">
                            Unidad: {row.suggested?.tela_unidad_medida || "METRO"}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <input
                            value={suggestedValue}
                            onChange={(event) =>
                                handleSuggestedChange(row.row_number, field, event.target.value)
                            }
                            placeholder={`Crear ${MISSING_LABELS[field]}`}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                        />
                    </div>
                )}
            </div>
        );
    };

    const handleProcessPreview = async () => {
        if (!processFile) {
            toast.error("Selecciona un archivo Excel de orden proceso");
            return;
        }

        setIsProcessPreviewing(true);
        try {
            const result = await previewBulkOrderProcess(processFile);
            setProcessSourceFileName(processFile.name);
            setProcessPreview(result);
            toast.success("Archivo de proceso prevalidado", {
                description: `${result.summary.total} filas encontradas`,
            });
        } catch (error) {
            setProcessPreview(null);
            toast.error("No se pudo prevalidar", {
                description:
                    error instanceof Error ? error.message : "Error leyendo el archivo",
            });
        } finally {
            setIsProcessPreviewing(false);
        }
    };

    const updateProcessRow = (
        rowNumber: number,
        updater: (row: BulkOrderProcessRowAPI) => BulkOrderProcessRowAPI,
    ) => {
        setProcessPreview((current) => {
            if (!current) return current;
            return {
                ...current,
                rows: current.rows.map((row) =>
                    row.row_number === rowNumber ? updater(row) : row,
                ),
            };
        });
    };

    const revalidateProcessRow = async (row: BulkOrderProcessRowAPI) => {
        setProcessRowsValidating((current) => new Set(current).add(row.row_number));
        try {
            const result = await revalidateBulkOrderProcessRow(row);
            updateProcessRow(row.row_number, () => result);
        } catch (error) {
            toast.error("No se pudo validar la fila", {
                description:
                    error instanceof Error ? error.message : "Error validando item",
            });
        } finally {
            setProcessRowsValidating((current) => {
                const next = new Set(current);
                next.delete(row.row_number);
                return next;
            });
        }
    };

    const handleProcessItemChange = (row: BulkOrderProcessRowAPI, item: string) => {
        updateProcessRow(row.row_number, (current) => ({
            ...current,
            item,
            resolved: { ...current.resolved, item_id: null },
            missing: ["item"],
            errors: item.trim() ? ["Pendiente validar item"] : ["Falta item"],
            status: "invalid",
            omitted: false,
        }));
    };

    const toggleProcessRowOmitted = (row: BulkOrderProcessRowAPI) => {
        updateProcessRow(row.row_number, (current) => ({
            ...current,
            omitted: current.status !== "omitted",
            status: current.status === "omitted" ? (current.missing.length ? "invalid" : "ready") : "omitted",
        }));
    };

    const handleProcessCommit = async () => {
        if (!processPreview) return;

        setIsProcessCommitting(true);
        try {
            const result = await commitBulkOrderProcess({ rows: processPreview.rows });
            toast.success("Orden proceso cargada", {
                description: `${result.inserted} creadas, ${result.updated} actualizadas, ${result.omitted} omitidas`,
            });
            setProcessPreview(null);
            setProcessFile(null);
            setProcessSourceFileName("");
        } catch (error) {
            toast.error("No se pudo cargar", {
                description:
                    error instanceof Error ? error.message : "Error guardando orden proceso",
            });
        } finally {
            setIsProcessCommitting(false);
        }
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
            setSourceFileName("");
            setFinalizedRows(new Set());
            setHomologationSearches({});
            window.localStorage.removeItem(BULK_DRAFT_STORAGE_KEY);
            setDraftInfo(null);
        } catch (error) {
            toast.error("No se pudo cargar", {
                description:
                    error instanceof Error ? error.message : "Error guardando la carga masiva",
            });
        } finally {
            setIsCommitting(false);
        }
    };

    const draftSavedLabel = draftInfo ? formatDraftDate(draftInfo.savedAt) : "";

    return (
        <div className="min-h-screen overflow-x-hidden bg-background">
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
                                Ordenes de compra y orden proceso desde Excel
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-6xl min-w-0 overflow-x-hidden px-4 py-8">
                <div className="mb-4 flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant={activeSection === "purchase-orders" ? "default" : "outline"}
                        onClick={() => setActiveSection("purchase-orders")}
                    >
                        Orden de compra
                    </Button>
                    <Button
                        type="button"
                        variant={activeSection === "order-process" ? "default" : "outline"}
                        onClick={() => setActiveSection("order-process")}
                    >
                        Orden proceso
                    </Button>
                </div>

                {activeSection === "purchase-orders" && (
                <Card className="min-w-0 overflow-hidden border border-border/80 bg-card shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                            <FileSpreadsheet className="h-5 w-5" />
                            Archivo de ordenes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="min-w-0 space-y-5 pt-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <input
                                type="file"
                                accept=".xlsx"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                onChange={(event) => {
                                    const selectedFile = event.target.files?.[0] ?? null;
                                    setFile(selectedFile);
                                    setSourceFileName(selectedFile?.name ?? "");
                                    setPreview(null);
                                    setFinalizedRows(new Set());
                                    setHomologationSearches({});
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

                        {draftInfo && !preview && (
                            <Alert>
                                <Save className="h-4 w-4" />
                                <AlertTitle>Avance guardado disponible</AlertTitle>
                                <AlertDescription>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <span>
                                            {draftInfo.fileName || "Carga masiva"} -{" "}
                                            {draftInfo.rows} filas
                                            {draftSavedLabel
                                                ? `, guardado ${draftSavedLabel}`
                                                : ""}
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={restoreDraft}
                                            >
                                                <RotateCcw className="mr-2 h-4 w-4" />
                                                Cargar avance
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={clearDraft}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Descartar
                                            </Button>
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {preview && (
                            <div className="grid gap-3 sm:grid-cols-4">
                                <div className="rounded-md border border-border bg-muted/20 p-3">
                                    <div className="text-xs text-muted-foreground">Filas</div>
                                    <div className="text-2xl font-semibold">{previewSummary.total}</div>
                                </div>
                                <div className="rounded-md border border-border bg-muted/20 p-3">
                                    <div className="text-xs text-muted-foreground">Archivo</div>
                                    <div className="truncate text-sm font-medium">
                                        {sourceFileName || "Borrador guardado"}
                                    </div>
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

                        {preview && (
                            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {draftInfo
                                        ? `Avance guardado${draftSavedLabel ? ` ${draftSavedLabel}` : ""}.`
                                        : "El avance se guarda automaticamente en este navegador."}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => saveDraft({ showToast: true })}
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        Guardar avance
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearDraft}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Descartar borrador
                                    </Button>
                                </div>
                            </div>
                        )}

                        {hasBlockingMissing && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Falta cliente</AlertTitle>
                                <AlertDescription>
                                    El cliente debe existir para crear la orden de compra.
                                    Base, modelo, referencias y tela pueden quedar vacios.
                                </AlertDescription>
                            </Alert>
                        )}

                        {preview && preview.rows.length > 0 && (
                            <div className="min-w-0 space-y-4">
                                <div
                                    className="max-h-[calc(100vh-410px)] overflow-auto rounded-md border border-border"
                                    style={{ scrollbarGutter: "stable" }}
                                >
                                    <table
                                        className="caption-bottom text-sm"
                                        style={{
                                            width: BULK_TABLE_WIDTH,
                                            tableLayout: "fixed",
                                        }}
                                    >
                                        <colgroup>
                                            {BULK_TABLE_COLUMNS.map((width, index) => (
                                                <col key={`${width}-${index}`} style={{ width }} />
                                            ))}
                                        </colgroup>
                                        <TableHeader className="sticky top-0 z-10 bg-card">
                                            <TableRow>
                                                <TableHead>Fila</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Nombre</TableHead>
                                                <TableHead>Tela</TableHead>
                                                <TableHead>Producto homologado</TableHead>
                                                <TableHead>Base</TableHead>
                                                <TableHead>Modelo</TableHead>
                                                <TableHead>Referencia 1</TableHead>
                                                <TableHead>Referencia 2</TableHead>
                                                <TableHead>Referencia 3</TableHead>
                                                <TableHead>Tela homologada</TableHead>
                                                <TableHead>Detalle</TableHead>
                                                <TableHead className="px-5">OC cliente</TableHead>
                                                <TableHead className="px-5 text-right">Cantidad</TableHead>
                                                <TableHead>Accion</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.rows.map((row, rowIndex) => (
                                                <TableRow
                                                    key={`${row.row_number}-${row.oc_interno}`}
                                                    className={
                                                        rowIndex % 2 === 0
                                                            ? "bg-card"
                                                            : "bg-muted/20"
                                                    }
                                                >
                                                    <TableCell>{row.row_number}</TableCell>
                                                    <TableCell>
                                                        <MissingBadges isFinalized={isRowFinalized(row)} />
                                                    </TableCell>
                                                    <TableCell>{row.cliente}</TableCell>
                                                    <TableCell className="whitespace-normal break-words align-top leading-snug">
                                                        {row.product_name}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal break-words align-top leading-snug">
                                                        {row.tela}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal break-words align-top">
                                                        <ProductHomologationBadge row={row} />
                                                    </TableCell>
                                                    <TableCell>{renderHomologationControl(row, "base")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "modelo")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "referencia_1")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "referencia_2")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "referencia_3")}</TableCell>
                                                    <TableCell>{renderHomologationControl(row, "tela")}</TableCell>
                                                    <TableCell className="align-top">
                                                        <textarea
                                                            value={row.detalle ?? ""}
                                                            onChange={(event) =>
                                                                updateRow(row.row_number, (current) => ({
                                                                    ...current,
                                                                    detalle: event.target.value,
                                                                }))
                                                            }
                                                            placeholder="Escribir detalle..."
                                                            rows={3}
                                                            className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-2 py-1 text-xs leading-snug text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="px-5">{row.oc_cliente}</TableCell>
                                                    <TableCell className="px-5 text-right font-medium">
                                                        {row.cantidad}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={isRowFinalized(row) ? "accent" : "outline"}
                                                            onClick={() => handleFinalizeRow(row)}
                                                            className="w-full justify-center"
                                                        >
                                                            {isRowFinalized(row) ? (
                                                                <>
                                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                    Finalizada
                                                                </>
                                                            ) : (
                                                                "Finalizar"
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </table>
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
                )}

                {activeSection === "order-process" && (
                    <Card className="min-w-0 overflow-hidden border border-border/80 bg-card shadow-sm">
                        <CardHeader className="border-b bg-muted/20">
                            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                                <FileSpreadsheet className="h-5 w-5" />
                                Archivo de orden proceso
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0 space-y-5 pt-6">
                            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                                Formato recomendado para fechas: <strong>YYYY-MM-DD</strong> o{" "}
                                <strong>YYYY-MM-DD HH:mm</strong>. Tambien se aceptan fechas de Excel
                                y formato <strong>DD/MM/YYYY</strong>.
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <input
                                    type="file"
                                    accept=".xlsx"
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    onChange={(event) => {
                                        const selectedFile = event.target.files?.[0] ?? null;
                                        setProcessFile(selectedFile);
                                        setProcessSourceFileName(selectedFile?.name ?? "");
                                        setProcessPreview(null);
                                    }}
                                />
                                <Button
                                    type="button"
                                    onClick={handleProcessPreview}
                                    disabled={!processFile || isProcessPreviewing}
                                    className="sm:w-auto"
                                >
                                    {isProcessPreviewing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                    )}
                                    Prevalidar
                                </Button>
                            </div>

                            {processPreview && (
                                <div className="grid gap-3 sm:grid-cols-5">
                                    <div className="rounded-md border border-border bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Filas</div>
                                        <div className="text-2xl font-semibold">{processSummary.total}</div>
                                    </div>
                                    <div className="rounded-md border border-border bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Archivo</div>
                                        <div className="truncate text-sm font-medium">
                                            {processSourceFileName || "Archivo de proceso"}
                                        </div>
                                    </div>
                                    <div className="rounded-md border border-border bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Listas</div>
                                        <div className="text-2xl font-semibold text-emerald-700">
                                            {processSummary.ready}
                                        </div>
                                    </div>
                                    <div className="rounded-md border border-border bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Con error</div>
                                        <div className="text-2xl font-semibold text-red-700">
                                            {processSummary.invalid}
                                        </div>
                                    </div>
                                    <div className="rounded-md border border-border bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Omitidas</div>
                                        <div className="text-2xl font-semibold text-muted-foreground">
                                            {processSummary.omitted}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {processPreview && processSummary.invalid > 0 && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Hay filas pendientes</AlertTitle>
                                    <AlertDescription>
                                        Corrige el item legado o omite la fila. La carga se habilita
                                        cuando todas las filas activas tengan item valido.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {processPreview && processPreview.rows.length > 0 && (
                                <div className="min-w-0 space-y-4">
                                    <div
                                        className="max-h-[calc(100vh-390px)] overflow-auto rounded-md border border-border"
                                        style={{ scrollbarGutter: "stable" }}
                                    >
                                        <table
                                            className="caption-bottom text-sm"
                                            style={{
                                                width: ORDER_PROCESS_TABLE_WIDTH,
                                                tableLayout: "fixed",
                                            }}
                                        >
                                            <colgroup>
                                                {ORDER_PROCESS_COLUMNS.map((width, index) => (
                                                    <col key={`${width}-${index}`} style={{ width }} />
                                                ))}
                                            </colgroup>
                                            <TableHeader className="sticky top-0 z-10 bg-card">
                                                <TableRow>
                                                    <TableHead>Fila</TableHead>
                                                    <TableHead>Estado</TableHead>
                                                    <TableHead>Item</TableHead>
                                                    <TableHead>ID Proceso</TableHead>
                                                    <TableHead>Fecha inicio</TableHead>
                                                    <TableHead>Fecha finalizacion</TableHead>
                                                    <TableHead>ID empleado</TableHead>
                                                    <TableHead>Comentario</TableHead>
                                                    <TableHead>Accion</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {processPreview.rows.map((row, rowIndex) => {
                                                    const isValidating = processRowsValidating.has(row.row_number);
                                                    return (
                                                        <TableRow
                                                            key={`${row.row_number}-${row.item}-${row.id_proceso}`}
                                                            className={rowIndex % 2 === 0 ? "bg-card" : "bg-muted/20"}
                                                        >
                                                            <TableCell>{row.row_number}</TableCell>
                                                            <TableCell>
                                                                <Badge
                                                                    variant={row.status === "invalid" ? "destructive" : "outline"}
                                                                    className={
                                                                        row.status === "ready"
                                                                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                                                            : row.status === "omitted"
                                                                              ? "border-muted bg-muted text-muted-foreground"
                                                                              : undefined
                                                                    }
                                                                >
                                                                    {row.status === "ready"
                                                                        ? "Lista"
                                                                        : row.status === "omitted"
                                                                          ? "Omitida"
                                                                          : "Revisar"}
                                                                </Badge>
                                                                {row.errors.length > 0 && row.status !== "omitted" && (
                                                                    <div className="mt-1 text-xs text-red-700">
                                                                        {row.errors.join(", ")}
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <input
                                                                    value={row.item}
                                                                    onChange={(event) =>
                                                                        handleProcessItemChange(row, event.target.value)
                                                                    }
                                                                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                                />
                                                            </TableCell>
                                                            <TableCell>{row.id_proceso}</TableCell>
                                                            <TableCell>{row.fecha_inicio}</TableCell>
                                                            <TableCell>{row.fecha_finalizado}</TableCell>
                                                            <TableCell>{row.id_empleado ?? ""}</TableCell>
                                                            <TableCell className="whitespace-normal break-words text-xs">
                                                                {row.comentarios}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => revalidateProcessRow(row)}
                                                                        disabled={isValidating}
                                                                    >
                                                                        {isValidating && (
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        )}
                                                                        Validar
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={row.status === "omitted" ? "outline" : "ghost"}
                                                                        onClick={() => toggleProcessRowOmitted(row)}
                                                                    >
                                                                        {row.status === "omitted" ? "Incluir" : "Omitir"}
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm text-muted-foreground">
                                            Al cargar, si ya existe una fila con el mismo item y proceso
                                            se actualiza; si no existe, se crea.
                                        </p>
                                        <Button
                                            type="button"
                                            onClick={handleProcessCommit}
                                            disabled={!canCommitProcess}
                                            className="sm:w-auto"
                                        >
                                            {isProcessCommitting ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                            )}
                                            Cargar ordenes de proceso
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}

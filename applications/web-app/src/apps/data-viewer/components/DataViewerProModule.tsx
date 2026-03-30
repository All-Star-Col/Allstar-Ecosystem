import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Filter,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/shared/ui/sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Sidebar } from "./Sidebar";
import { DataGrid } from "./DataGrid";
import { DataToolbar } from "./DataToolbar";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { RowEditSheet } from "./RowEditSheet";
import {
    DataViewerApiError,
    exportDataViewerCsv,
    fetchDataViewerTables,
    queryDataViewer,
    updateDataViewerRow,
} from "../api";
import { humanizeColumnName } from "../data/columnUtils";
import {
    buildRowChanges,
    canEditRow,
    getEditableColumns,
    getQueryColumnKeys,
    getTableEditDisabledReason,
} from "../data/editing";
import type {
    DataViewerFilter,
    DataViewerFilterOperator,
    DataViewerModuleProps,
    DataViewerQueryRequest,
    DataViewerQueryResponse,
    DataViewerRow,
    DataViewerSort,
    DataViewerTable,
} from "../types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const FILTER_OPERATOR_LABELS: Record<DataViewerFilterOperator, string> = {
    eq: "igual a",
    contains: "contiene",
    gt: "mayor que",
    lt: "menor que",
    in: "incluye",
    between: "entre",
};

interface UiErrorState {
    code?: string;
    detail: string;
    requestId?: string;
}

interface DraftFilterState {
    column: string;
    operator: DataViewerFilterOperator;
    value: string;
    valueTo: string;
}

function clampLimit(limit?: number): number {
    if (!limit) {
        return DEFAULT_LIMIT;
    }

    return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

function getInitialTableId(
    tables: DataViewerTable[],
    preferred?: string,
): string {
    if (preferred && tables.some((table) => table.table_id === preferred)) {
        return preferred;
    }

    return tables[0]?.table_id ?? "";
}

function getDefaultVisibleColumns(
    table: DataViewerTable | undefined,
): Set<string> {
    if (!table) {
        return new Set();
    }

    const explicitVisible = table.columns
        .filter((column) => column.visible)
        .map((column) => column.name);

    const fallback =
        explicitVisible.length > 0
            ? explicitVisible
            : table.columns.map((column) => column.name);

    return new Set(fallback);
}

function isNumericType(type: string): boolean {
    return ["integer", "bigint", "decimal", "float", "numeric"].includes(type);
}

function isBooleanType(type: string): boolean {
    return type === "boolean";
}

function parseScalarValue(rawValue: string, columnType: string): unknown {
    const trimmed = rawValue.trim();

    if (trimmed.toLowerCase() === "null") {
        return null;
    }

    if (isBooleanType(columnType)) {
        if (trimmed.toLowerCase() === "true") {
            return true;
        }
        if (trimmed.toLowerCase() === "false") {
            return false;
        }
    }

    if (isNumericType(columnType)) {
        const maybeNumber = Number(trimmed);
        if (!Number.isNaN(maybeNumber)) {
            return maybeNumber;
        }
    }

    return trimmed;
}

function getCodeMessage(code?: string): string {
    switch (code) {
        case "LIMIT_EXCEEDED":
            return "El limite por pagina supera el maximo permitido (200).";
        case "EXPORT_MAX_EXCEEDED":
            return "La exportacion supera el maximo permitido de 10,000 filas.";
        case "TABLE_NOT_CONFIGURED":
            return "La tabla seleccionada no esta configurada para Data Viewer.";
        case "INVALID_Q_LENGTH":
            return "La busqueda global supera el maximo permitido de 100 caracteres.";
        case "NO_STABLE_ORDER_COLUMN":
            return "La tabla no tiene una columna de orden estable configurada en backend.";
        case "QUERY_TIMEOUT":
            return "La consulta excedio el tiempo maximo de ejecucion. Intenta con menos filtros.";
        case "INVALID_FILTER":
            return "Uno o mas filtros no cumplen el contrato esperado.";
        case "UNSUPPORTED_OPERATOR":
            return "El operador de filtro no esta soportado por el backend.";
        case "INVALID_IDENTIFIER":
            return "Se envio un identificador invalido de tabla o columna.";
        case "TABLE_NOT_EDITABLE":
            return "La tabla no permite edicion de filas.";
        case "NO_PK_DEFINED":
            return "La tabla no tiene PK definida para actualizar filas.";
        case "PK_REQUIRED":
            return "No se envio la llave primaria completa de la fila.";
        case "ROW_NOT_FOUND":
            return "La fila que intentas actualizar ya no existe.";
        case "COLUMN_NOT_EDITABLE":
            return "Hay columnas no editables en los cambios enviados.";
        case "VALIDATION_ERROR":
            return "Hay errores de validacion en los datos del formulario.";
        case "CONFLICT_VERSION":
            return "La fila fue modificada por otro usuario. Recarga y vuelve a intentar.";
        case "CONCURRENCY_NOT_SUPPORTED":
            return "La tabla no soporta concurrencia optimista en backend.";
        default:
            return "No fue posible completar la operacion con Data Viewer.";
    }
}

function normalizeError(error: unknown): UiErrorState {
    if (error instanceof DataViewerApiError) {
        return {
            code: error.code,
            detail: getCodeMessage(error.code) + ` ${error.message}`,
            requestId: error.requestId,
        };
    }

    if (error instanceof Error) {
        return {
            detail: `${getCodeMessage()} ${error.message}`,
        };
    }

    return {
        detail: getCodeMessage(),
    };
}

function getFilterSummary(filter: DataViewerFilter): string {
    const columnLabel = humanizeColumnName(filter.column);

    if (filter.operator === "between") {
        return `${columnLabel} entre ${String(filter.value)} y ${String(filter.value_to)}`;
    }

    if (filter.operator === "in") {
        const values = Array.isArray(filter.value)
            ? filter.value.map((value) => String(value)).join(", ")
            : String(filter.value);
        return `${columnLabel} en (${values})`;
    }

    if (filter.operator === "eq") {
        return `${columnLabel} = ${String(filter.value)}`;
    }

    if (filter.operator === "gt") {
        return `${columnLabel} > ${String(filter.value)}`;
    }

    if (filter.operator === "lt") {
        return `${columnLabel} < ${String(filter.value)}`;
    }

    return `${columnLabel} ${FILTER_OPERATOR_LABELS[filter.operator]} ${String(filter.value)}`;
}

function isIdLikeColumn(columnName: string): boolean {
    return columnName === "id" || columnName.endsWith("_id");
}

function triggerCsvDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
}

function buildQueryPayload(args: {
    tableId: string;
    columns: string[];
    filters: DataViewerFilter[];
    sort: DataViewerSort | null;
    q: string;
    limit: number;
    offset: number;
    includeTotal: boolean;
}): DataViewerQueryRequest {
    return {
        table_id: args.tableId,
        columns: args.columns,
        filters: args.filters.length > 0 ? args.filters : undefined,
        sort: args.sort ?? undefined,
        q: args.q || undefined,
        limit: args.limit,
        offset: args.offset,
        include_total: args.includeTotal,
    };
}

export function DataViewerProModule({
    initialTableId,
    title = "Data Viewer Pro",
    subtitle = "Gestion de datos",
    className,
    style,
    onBack,
    showBackButton = true,
    defaultLimit,
}: DataViewerModuleProps) {
    const [tables, setTables] = useState<DataViewerTable[]>([]);
    const [activeTableId, setActiveTableId] = useState("");
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
        new Set(),
    );

    const [globalFilterInput, setGlobalFilterInput] = useState("");
    const [globalFilter, setGlobalFilter] = useState("");
    const [filters, setFilters] = useState<DataViewerFilter[]>([]);
    const [sort, setSort] = useState<DataViewerSort | null>(null);

    const [includeTotal, setIncludeTotal] = useState(true);
    const [limit, setLimit] = useState(clampLimit(defaultLimit));
    const [offset, setOffset] = useState(0);

    const [isTablesLoading, setIsTablesLoading] = useState(true);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [queryResult, setQueryResult] = useState<DataViewerQueryResponse>({
        rows: [],
        total_count: null,
        limit: clampLimit(defaultLimit),
        offset: 0,
        has_more: false,
    });

    const [uiError, setUiError] = useState<UiErrorState | null>(null);
    const [rowSaveError, setRowSaveError] = useState<UiErrorState | null>(null);
    const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<DataViewerRow | null>(null);
    const [isSavingRow, setIsSavingRow] = useState(false);
    const [pendingRetryDraftValues, setPendingRetryDraftValues] =
        useState<Record<string, unknown> | null>(null);

    const [tablesReloadCounter, setTablesReloadCounter] = useState(0);
    const [refreshCounter, setRefreshCounter] = useState(0);
    const manualRefreshPendingRef = useRef(false);

    const [draftFilter, setDraftFilter] = useState<DraftFilterState>({
        column: "",
        operator: "eq",
        value: "",
        valueTo: "",
    });

    const activeTable = useMemo(
        () => tables.find((table) => table.table_id === activeTableId),
        [activeTableId, tables],
    );

    const activeDraftColumn = useMemo(
        () =>
            activeTable?.columns.find(
                (column) => column.name === draftFilter.column,
            ),
        [activeTable, draftFilter.column],
    );

    const tableEditDisabledReason = useMemo(
        () => getTableEditDisabledReason(activeTable),
        [activeTable],
    );

    const editableColumns = useMemo(
        () => getEditableColumns(activeTable),
        [activeTable],
    );

    const visibleColumnKeys = useMemo(() => {
        if (!activeTable) {
            return [] as string[];
        }

        const ordered = activeTable.columns
            .map((column) => column.name)
            .filter((columnName) => visibleColumns.has(columnName));

        if (ordered.length > 0) {
            return ordered;
        }

        return activeTable.columns.map((column) => column.name);
    }, [activeTable, visibleColumns]);

    const visibleColumnsFingerprint = useMemo(
        () => visibleColumnKeys.join("|"),
        [visibleColumnKeys],
    );

    const queryColumnKeys = useMemo(() => {
        const baseColumns = getQueryColumnKeys(activeTable, visibleColumnKeys);
        const sortColumn = sort?.column;
        const defaultOrderColumn =
            activeTable?.default_order_column ??
            activeTable?.stable_order_column;

        const mergedColumns = [
            ...baseColumns,
            sortColumn,
            defaultOrderColumn,
        ].filter((columnName): columnName is string => Boolean(columnName));

        return [...new Set(mergedColumns)];
    }, [activeTable, sort, visibleColumnKeys]);

    const firstVisibleColumn = activeTable?.columns[0]?.name ?? "";

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setGlobalFilter(globalFilterInput.trim());
        }, 350);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [globalFilterInput]);

    useEffect(() => {
        setOffset(0);
    }, [
        activeTableId,
        globalFilter,
        sort,
        filters,
        limit,
        includeTotal,
        visibleColumnsFingerprint,
    ]);

    useEffect(() => {
        if (!activeTable) {
            setVisibleColumns(new Set());
            setDraftFilter({
                column: "",
                operator: "eq",
                value: "",
                valueTo: "",
            });
            return;
        }

        setVisibleColumns(getDefaultVisibleColumns(activeTable));
        setFilters([]);
        setSort(() => {
            const defaultSortColumn =
                activeTable.default_order_column ??
                activeTable.stable_order_column;
            if (!defaultSortColumn) {
                return null;
            }

            return {
                column: defaultSortColumn,
                direction: "asc",
            };
        });
        setGlobalFilterInput("");
        setGlobalFilter("");
        setIsEditSheetOpen(false);
        setSelectedRow(null);
        setRowSaveError(null);
        setPendingRetryDraftValues(null);
        setDraftFilter({
            column: firstVisibleColumn,
            operator: "eq",
            value: "",
            valueTo: "",
        });
    }, [activeTable, firstVisibleColumn]);

    useEffect(() => {
        let ignore = false;

        async function loadTables() {
            setIsTablesLoading(true);

            try {
                const { tables: tableResponse } = await fetchDataViewerTables();
                if (ignore) {
                    return;
                }

                setTables(tableResponse);

                setActiveTableId((current) => {
                    if (
                        current &&
                        tableResponse.some(
                            (table) => table.table_id === current,
                        )
                    ) {
                        return current;
                    }

                    return getInitialTableId(tableResponse, initialTableId);
                });
                setUiError(null);
            } catch (error) {
                if (ignore) {
                    return;
                }

                const normalized = normalizeError(error);
                setUiError(normalized);
                toast.error("Error cargando tablas", {
                    description: normalized.requestId
                        ? `${normalized.detail} (request_id: ${normalized.requestId})`
                        : normalized.detail,
                });
            } finally {
                if (!ignore) {
                    setIsTablesLoading(false);
                }
            }
        }

        void loadTables();

        return () => {
            ignore = true;
        };
    }, [initialTableId, tablesReloadCounter]);

    useEffect(() => {
        if (!activeTable) {
            setQueryResult((previous) => ({
                ...previous,
                rows: [],
                total_count: null,
                has_more: false,
                offset,
                limit,
            }));
            return;
        }

        if (activeTable.order_error_code === "NO_STABLE_ORDER_COLUMN") {
            const detail = getCodeMessage("NO_STABLE_ORDER_COLUMN");
            setUiError({
                code: "NO_STABLE_ORDER_COLUMN",
                detail,
            });
            setQueryResult((previous) => ({
                ...previous,
                rows: [],
                total_count: null,
                has_more: false,
                offset,
                limit,
            }));
            return;
        }

        const controller = new AbortController();
        const queryPayload = buildQueryPayload({
            tableId: activeTable.table_id,
            columns: queryColumnKeys,
            filters,
            sort,
            q: globalFilter,
            limit,
            offset,
            includeTotal,
        });

        async function loadRows() {
            setIsQueryLoading(true);

            try {
                const { result } = await queryDataViewer(queryPayload, {
                    signal: controller.signal,
                });

                setQueryResult(result);
                setUiError(null);

                if (manualRefreshPendingRef.current) {
                    toast.success("Datos actualizados");
                    manualRefreshPendingRef.current = false;
                }
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                const normalized = normalizeError(error);
                setUiError(normalized);
                setQueryResult((previous) => ({
                    ...previous,
                    rows: [],
                    total_count: null,
                    has_more: false,
                    offset,
                    limit,
                }));

                toast.error("Error en consulta de datos", {
                    description: normalized.requestId
                        ? `${normalized.detail} (request_id: ${normalized.requestId})`
                        : normalized.detail,
                });

                if (manualRefreshPendingRef.current) {
                    manualRefreshPendingRef.current = false;
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsQueryLoading(false);
                }
            }
        }

        void loadRows();

        return () => {
            controller.abort();
        };
    }, [
        activeTable,
        globalFilter,
        sort,
        filters,
        limit,
        offset,
        includeTotal,
        visibleColumnsFingerprint,
        refreshCounter,
        queryColumnKeys,
    ]);

    const handleToggleColumn = (columnId: string) => {
        setVisibleColumns((previous) => {
            if (previous.has(columnId) && previous.size === 1) {
                toast.warning("Debe quedar al menos una columna visible");
                return previous;
            }

            const next = new Set(previous);
            if (next.has(columnId)) {
                next.delete(columnId);
            } else {
                next.add(columnId);
            }

            return next;
        });
    };

    const handleRefresh = () => {
        toast.info("Actualizando datos...");
        manualRefreshPendingRef.current = true;
        setRefreshCounter((previous) => previous + 1);
    };

    const handleTableSelect = (tableId: string) => {
        setActiveTableId(tableId);
    };

    const handleRetryView = () => {
        if (!activeTable) {
            toast.info("Reintentando carga de tablas...");
            setTablesReloadCounter((previous) => previous + 1);
            return;
        }

        handleRefresh();
    };

    const getGridRowEditState = useCallback((row: DataViewerRow) => {
        const rowEditState = canEditRow(activeTable, row);
        return {
            enabled: rowEditState.allowed,
            reason: rowEditState.reason,
        };
    }, [activeTable]);

    const handleEditRow = (row: DataViewerRow) => {
        const rowEditState = canEditRow(activeTable, row);
        if (!rowEditState.allowed) {
            toast.warning("No se puede editar esta fila", {
                description: rowEditState.reason,
            });
            return;
        }

        setSelectedRow(row);
        setRowSaveError(null);
        setPendingRetryDraftValues(null);
        setIsEditSheetOpen(true);
    };

    const persistRowEdition = async (draftValues: Record<string, unknown>) => {
        if (!activeTable || !selectedRow) {
            return;
        }

        const rowEditState = canEditRow(activeTable, selectedRow);
        if (!rowEditState.allowed || !rowEditState.pk) {
            const reason =
                rowEditState.reason ??
                "No se pudo validar la fila para actualizar.";
            setRowSaveError({
                detail: reason,
            });
            toast.error("No se pudo guardar la fila", {
                description: reason,
            });
            return;
        }

        const changes = buildRowChanges({
            row: selectedRow,
            editableColumns,
            draftValues,
        });

        if (Object.keys(changes).length === 0) {
            toast.info("No hay cambios para guardar");
            return;
        }

        setIsSavingRow(true);
        setRowSaveError(null);
        setPendingRetryDraftValues(draftValues);

        try {
            const { requestId } = await updateDataViewerRow({
                table_id: activeTable.table_id,
                pk: rowEditState.pk,
                changes,
            });

            toast.success("Fila actualizada correctamente", {
                description: `request_id: ${requestId}`,
            });

            setIsEditSheetOpen(false);
            setSelectedRow(null);
            setPendingRetryDraftValues(null);
            setRowSaveError(null);
            setRefreshCounter((previous) => previous + 1);
        } catch (error) {
            const normalized = normalizeError(error);
            setRowSaveError(normalized);
            toast.error("No se pudo guardar la fila", {
                description: normalized.requestId
                    ? `${normalized.detail} (request_id: ${normalized.requestId})`
                    : normalized.detail,
            });
        } finally {
            setIsSavingRow(false);
        }
    };

    const handleRetryRowEdition = () => {
        if (!pendingRetryDraftValues) {
            return;
        }

        void persistRowEdition(pendingRetryDraftValues);
    };

    const handleAddFilter = () => {
        if (!activeTable) {
            return;
        }

        const selectedColumn = activeTable.columns.find(
            (column) => column.name === draftFilter.column,
        );

        if (!selectedColumn) {
            toast.error("Selecciona una columna valida para el filtro");
            return;
        }

        if (!draftFilter.value.trim()) {
            toast.error("El valor del filtro es obligatorio");
            return;
        }

        const nextFilter: DataViewerFilter = {
            column: draftFilter.column,
            operator: draftFilter.operator,
            value: "",
        };

        if (draftFilter.operator === "in") {
            const values = draftFilter.value
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean)
                .map((entry) => parseScalarValue(entry, selectedColumn.type));

            if (values.length === 0) {
                toast.error(
                    "Para IN debes ingresar uno o mas valores separados por coma",
                );
                return;
            }

            nextFilter.value = values;
        } else if (draftFilter.operator === "between") {
            if (!draftFilter.valueTo.trim()) {
                toast.error("BETWEEN requiere valor inicial y valor final");
                return;
            }

            nextFilter.value = parseScalarValue(
                draftFilter.value,
                selectedColumn.type,
            );
            nextFilter.value_to = parseScalarValue(
                draftFilter.valueTo,
                selectedColumn.type,
            );
        } else {
            nextFilter.value = parseScalarValue(
                draftFilter.value,
                selectedColumn.type,
            );
        }

        setFilters((previous) => [...previous, nextFilter]);
        setDraftFilter((previous) => ({
            ...previous,
            value: "",
            valueTo: "",
        }));
    };

    const handleExport = async () => {
        if (!activeTable) {
            toast.error("No hay tabla seleccionada para exportar");
            return;
        }

        setIsExporting(true);

        try {
            const exportPayload = buildQueryPayload({
                tableId: activeTable.table_id,
                columns: visibleColumnKeys,
                filters,
                sort,
                q: globalFilter,
                // El backend actual valida limit <= 200 tambien en export.
                limit: MAX_LIMIT,
                offset: 0,
                includeTotal: false,
            });

            const { blob, filename } = await exportDataViewerCsv(exportPayload);
            triggerCsvDownload(blob, filename);
            toast.success("Archivo CSV exportado correctamente");
        } catch (error) {
            const normalized = normalizeError(error);
            toast.error("No fue posible exportar el archivo", {
                description: normalized.requestId
                    ? `${normalized.detail} (request_id: ${normalized.requestId})`
                    : normalized.detail,
            });
        } finally {
            setIsExporting(false);
        }
    };

    const rowsCount = queryResult.rows.length;
    const hasRows = rowsCount > 0;

    const rangeStart = hasRows ? queryResult.offset + 1 : 0;
    const rangeEnd = queryResult.offset + rowsCount;
    const canGoPrev = queryResult.offset > 0;
    const canGoNext = queryResult.has_more;

    const draftValuePlaceholder = useMemo(() => {
        if (draftFilter.operator === "between") {
            return "Valor inicial";
        }

        if (draftFilter.operator === "in") {
            return isIdLikeColumn(draftFilter.column)
                ? "Ej: 1001,1002,1003"
                : "valor1, valor2";
        }

        if (isIdLikeColumn(draftFilter.column)) {
            return "Ej: 1001";
        }

        if (!activeDraftColumn) {
            return "Valor";
        }

        return `Valor de ${humanizeColumnName(activeDraftColumn.name)}`;
    }, [activeDraftColumn, draftFilter.column, draftFilter.operator]);

    const handleClearFilters = () => {
        setFilters([]);
    };

    return (
        <div
            className={`data-viewer-pro-module flex h-full min-h-[600px] overflow-hidden bg-background ${className ?? ""}`}
            style={style}
        >
            <Toaster position="top-right" richColors />

            <Sidebar
                tables={tables.map((table) => ({
                    id: table.table_id,
                    displayName: table.display_name,
                    technicalName: table.table_name,
                    disabledReason:
                        table.order_error_code === "NO_STABLE_ORDER_COLUMN"
                            ? getCodeMessage(table.order_error_code)
                            : undefined,
                }))}
                title={title}
                subtitle={subtitle}
                activeTable={activeTableId}
                onTableSelect={handleTableSelect}
                onBack={onBack}
                showBackButton={showBackButton}
            />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div className="bg-card border-b border-border px-8 py-6">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-semibold text-foreground">
                                    {activeTable?.display_name ??
                                        "No hay tablas disponibles"}
                                </h1>
                            </div>

                            <div className="flex items-center gap-3 mt-1">
                                {activeTable && (
                                    <div
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full ${
                                            tableEditDisabledReason
                                                ? "bg-warning/10 border-warning/30 text-warning-foreground"
                                                : "bg-success/85 border-success/30 text-success-foreground"
                                        }`}
                                        title={
                                            tableEditDisabledReason ??
                                            "Tabla editable"
                                        }
                                    >
                                        <span className="text-xs font-medium ">
                                            {tableEditDisabledReason
                                                ? "Edicion bloqueada"
                                                : "Edicion habilitada"}
                                        </span>
                                    </div>
                                )}
                                {(globalFilter || filters.length > 0) && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/30 rounded-full">
                                        <Filter className="w-3.5 h-3.5 text-accent" />
                                        <span className="text-xs font-medium text-accent">
                                            {filters.length} filtros · q:{" "}
                                            {globalFilter || "-"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4 flex-wrap items-end">
                            <div className="min-w-[320px] flex-1 rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
                                <div className="flex flex-wrap items-end gap-2">
                                    <Select
                                        value={draftFilter.column || undefined}
                                        onValueChange={(nextColumn) =>
                                            setDraftFilter((previous) => ({
                                                ...previous,
                                                column: nextColumn,
                                                operator: isIdLikeColumn(
                                                    nextColumn,
                                                )
                                                    ? "eq"
                                                    : previous.operator,
                                            }))
                                        }
                                        disabled={!activeTable}
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="w-[190px]"
                                        >
                                            <SelectValue placeholder="Columna" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(activeTable?.columns ?? []).map(
                                                (column) => (
                                                    <SelectItem
                                                        key={column.name}
                                                        value={column.name}
                                                    >
                                                        {humanizeColumnName(
                                                            column.name,
                                                        )}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={draftFilter.operator}
                                        onValueChange={(nextOperator) =>
                                            setDraftFilter((previous) => ({
                                                ...previous,
                                                operator:
                                                    nextOperator as DataViewerFilterOperator,
                                            }))
                                        }
                                        disabled={!activeTable}
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="w-[160px]"
                                        >
                                            <SelectValue placeholder="Operador" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="eq">
                                                igual a
                                            </SelectItem>
                                            <SelectItem value="contains">
                                                contiene
                                            </SelectItem>
                                            <SelectItem value="gt">
                                                mayor que
                                            </SelectItem>
                                            <SelectItem value="lt">
                                                menor que
                                            </SelectItem>
                                            <SelectItem value="in">
                                                incluye
                                            </SelectItem>
                                            <SelectItem value="between">
                                                entre
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Input
                                        value={draftFilter.value}
                                        onChange={(event) =>
                                            setDraftFilter((previous) => ({
                                                ...previous,
                                                value: event.target.value,
                                            }))
                                        }
                                        placeholder={draftValuePlaceholder}
                                        className="h-8 min-w-[170px] flex-1"
                                        disabled={!activeTable}
                                    />

                                    {draftFilter.operator === "between" && (
                                        <Input
                                            value={draftFilter.valueTo}
                                            onChange={(event) =>
                                                setDraftFilter((previous) => ({
                                                    ...previous,
                                                    valueTo: event.target.value,
                                                }))
                                            }
                                            placeholder="Valor final"
                                            className="h-8 min-w-[170px] flex-1"
                                            disabled={!activeTable}
                                        />
                                    )}

                                    <Button
                                        type="button"
                                        onClick={handleAddFilter}
                                        disabled={!activeTable}
                                        size="sm"
                                        variant="primary"
                                        className="shrink-0"
                                    >
                                        <Filter className="h-3.5 w-3.5" />
                                        Agregar
                                    </Button>

                                    {filters.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="shrink-0"
                                            onClick={handleClearFilters}
                                        >
                                            Limpiar
                                        </Button>
                                    )}
                                </div>

                                {filters.length > 0 && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {filters.map((filter, index) => (
                                            <span
                                                key={`${filter.column}-${filter.operator}-${index}`}
                                                className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                                            >
                                                <span className="truncate">
                                                    {getFilterSummary(filter)}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() =>
                                                        setFilters((previous) =>
                                                            previous.filter(
                                                                (
                                                                    _,
                                                                    candidateIndex,
                                                                ) =>
                                                                    candidateIndex !==
                                                                    index,
                                                            ),
                                                        )
                                                    }
                                                    className="size-5 rounded-full text-primary hover:text-destructive"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </Button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <DataToolbar
                            onExportCSV={handleExport}
                            disabled={
                                !activeTable || isTablesLoading || isExporting
                            }
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-8 min-h-0 flex flex-col gap-4">
                    {isTablesLoading || (isQueryLoading && !hasRows) ? (
                        <LoadingSkeleton />
                    ) : uiError ? (
                        <div className="flex-1 bg-card rounded-lg border border-destructive/30 p-6 flex items-center justify-center">
                            <div className="max-w-xl text-center space-y-3">
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 text-destructive">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    Error consultando Data Viewer
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {uiError.detail}
                                </p>
                                {uiError.requestId && (
                                    <p className="text-xs text-muted-foreground">
                                        request_id: {uiError.requestId}
                                    </p>
                                )}
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={handleRetryView}
                                        className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 min-h-0">
                                <DataGrid
                                    rows={queryResult.rows}
                                    tableLabel={
                                        activeTable?.display_name ??
                                        activeTableId
                                    }
                                    visibleColumnKeys={visibleColumnKeys}
                                    sort={sort}
                                    onSortChange={setSort}
                                    onEditRow={
                                        tableEditDisabledReason
                                            ? undefined
                                            : handleEditRow
                                    }
                                    getRowEditState={
                                        tableEditDisabledReason
                                            ? undefined
                                            : getGridRowEditState
                                    }
                                />
                            </div>

                            <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                                <div className="text-sm text-muted-foreground">
                                    Mostrando {rangeStart}-{rangeEnd}
                                    {includeTotal &&
                                    queryResult.total_count !== null
                                        ? ` de ${queryResult.total_count.toLocaleString("es-CO")}`
                                        : ""}
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-muted-foreground">
                                        Filas por pagina
                                    </label>
                                    <select
                                        value={limit}
                                        onChange={(event) =>
                                            setLimit(Number(event.target.value))
                                        }
                                        className="border border-border rounded-md px-2 py-1 text-sm"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        onClick={() =>
                                            setOffset((previous) =>
                                                Math.max(previous - limit, 0),
                                            )
                                        }
                                        disabled={!canGoPrev || isQueryLoading}
                                        className="inline-flex items-center gap-1 border border-border rounded-md px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Anterior
                                    </button>

                                    <button
                                        onClick={() =>
                                            setOffset(
                                                (previous) => previous + limit,
                                            )
                                        }
                                        disabled={!canGoNext || isQueryLoading}
                                        className="inline-flex items-center gap-1 border border-border rounded-md px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Siguiente
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <RowEditSheet
                open={isEditSheetOpen}
                row={selectedRow}
                editableColumns={editableColumns}
                tableLabel={activeTable?.display_name ?? activeTableId}
                isSaving={isSavingRow}
                saveError={rowSaveError}
                disabledReason={tableEditDisabledReason}
                onOpenChange={(nextOpen) => {
                    setIsEditSheetOpen(nextOpen);
                    if (!nextOpen) {
                        setSelectedRow(null);
                        setRowSaveError(null);
                        setPendingRetryDraftValues(null);
                    }
                }}
                onSubmit={(draftValues) => {
                    void persistRowEdition(draftValues);
                }}
                onRetry={handleRetryRowEdition}
            />
        </div>
    );
}

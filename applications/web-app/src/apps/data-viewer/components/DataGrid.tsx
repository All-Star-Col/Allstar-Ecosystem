import { useCallback } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import {
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/shared/ui/table";
import { getColumnType, humanizeColumnName } from "../data/columnUtils";
import type { DataViewerRow, DataViewerSort } from "../types";

interface DataGridProps {
    rows: DataViewerRow[];
    tableLabel: string;
    visibleColumnKeys: string[];
    sort: DataViewerSort | null;
    onSortChange: (sort: DataViewerSort | null) => void;
    onEditRow?: (row: DataViewerRow) => void;
    getRowEditState?: (row: DataViewerRow) => {
        enabled: boolean;
        reason?: string;
    };
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

function isIdentifierColumn(columnKey: string): boolean {
    const normalized = columnKey.toLowerCase();
    return (
        normalized === "id" ||
        normalized.startsWith("id_") ||
        normalized.endsWith("_id")
    );
}

function CellRenderer({
    value,
    columnKey,
}: {
    value: unknown;
    columnKey: string;
}) {
    const cellType = getColumnType(value);

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">null</span>;
    }

    if (isIdentifierColumn(columnKey)) {
        return (
            <span className="font-mono tabular-nums" title={String(value)}>
                {String(value)}
            </span>
        );
    }

    if (cellType === "boolean") {
        return (
            <Switch
                checked={Boolean(value)}
                className="cursor-default"
                disabled
            />
        );
    }

    if (cellType === "currency" && typeof value === "number") {
        return (
            <span className="font-mono tabular-nums">
                {new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: "COP",
                    maximumFractionDigits: 2,
                }).format(value)}
            </span>
        );
    }

    if (cellType === "number" && typeof value === "number") {
        return (
            <span className="font-mono tabular-nums">
                {new Intl.NumberFormat("es-CO").format(value)}
            </span>
        );
    }

    if (cellType === "date" && typeof value === "string") {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return (
                <span className="text-foreground">
                    {DATE_FORMATTER.format(parsed)}
                </span>
            );
        }
    }

    if (cellType === "email") {
        return <span className="text-primary">{String(value)}</span>;
    }

    return (
        <span className="block whitespace-nowrap" title={String(value)}>
            {String(value)}
        </span>
    );
}

function SortIcon({
    column,
    sort,
}: {
    column: string;
    sort: DataViewerSort | null;
}) {
    if (!sort || sort.column !== column) {
        return <ArrowUpDown className="w-3.5 h-3.5 text-primary/50" />;
    }

    if (sort.direction === "asc") {
        return <ArrowUp className="w-3.5 h-3.5 text-accent" />;
    }

    return <ArrowDown className="w-3.5 h-3.5 text-accent" />;
}

function getStableRowKey(
    row: DataViewerRow,
    rowIndex: number,
    tableLabel: string,
): string {
    const preferredKeys = ["id", "uuid", "code"];

    for (const key of preferredKeys) {
        const value = row[key];
        if (typeof value === "string" || typeof value === "number") {
            return `${tableLabel}-${key}-${value}`;
        }
    }

    return `${tableLabel}-${rowIndex}`;
}

function EditCell({
    row,
    onEditRow,
    getRowEditState,
}: {
    row: DataViewerRow;
    onEditRow?: (row: DataViewerRow) => void;
    getRowEditState?: (row: DataViewerRow) => { enabled: boolean; reason?: string };
}) {
    const editState = getRowEditState?.(row) ?? { enabled: true };

    return (
        <TableCell className="px-4 py-3 text-foreground align-middle">
            <div className="flex items-center justify-center w-full">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditRow?.(row)}
                    disabled={!editState.enabled}
                    title={editState.enabled ? "Editar fila" : editState.reason}
                >
                    <Pencil className="w-3.5 h-3.5" />
                </Button>
            </div>
        </TableCell>
    );
}

export function DataGrid({
    rows,
    tableLabel,
    visibleColumnKeys,
    sort,
    onSortChange,
    onEditRow,
    getRowEditState,
}: DataGridProps) {
    const showEditColumn = typeof onEditRow === "function";

    const handleSortToggle = useCallback((column: string) => {
        if (!sort || sort.column !== column) {
            onSortChange({ column, direction: "asc" });
            return;
        }

        if (sort.direction === "asc") {
            onSortChange({ column, direction: "desc" });
            return;
        }

        onSortChange(null);
    }, [sort, onSortChange]);

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-card rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">
                        No hay registros
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        La tabla {tableLabel || "seleccionada"} no contiene
                        datos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-card rounded-lg shadow-sm border border-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
                <table className="w-full min-w-max caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/70 [&_tr]:border-b-0">
                        <tr>
                            {visibleColumnKeys.map((columnKey) => (
                                <TableHead
                                    key={columnKey}
                                    className="text-foreground px-4 py-3 text-center align-middle"
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleSortToggle(columnKey)
                                        }
                                        className="w-full flex items-center justify-center gap-2 text-foreground hover:bg-primary/5 hover:text-foreground"
                                    >
                                        <span>
                                            {humanizeColumnName(columnKey)}
                                        </span>
                                        <SortIcon
                                            column={columnKey}
                                            sort={sort}
                                        />
                                    </Button>
                                </TableHead>
                            ))}
                            {showEditColumn && (
                                <TableHead className="text-foreground px-4 py-3 text-center">
                                    Editar
                                </TableHead>
                            )}
                        </tr>
                    </TableHeader>

                    <TableBody>
                        {rows.map((row, rowIndex) => (
                            <TableRow
                                key={getStableRowKey(row, rowIndex, tableLabel)}
                                className="hover:bg-accent/20"
                            >
                                {visibleColumnKeys.map((columnKey) => (
                                    <TableCell
                                        key={`${rowIndex}-${columnKey}`}
                                        className="px-4 py-3 text-[13px] text-foreground align-middle"
                                    >
                                        <div className="flex items-center justify-center w-full">
                                            <CellRenderer
                                                value={row[columnKey]}
                                                columnKey={columnKey}
                                            />
                                        </div>
                                    </TableCell>
                                ))}
                                {showEditColumn && (
                                    <EditCell
                                        row={row}
                                        onEditRow={onEditRow}
                                        getRowEditState={getRowEditState}
                                    />
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </table>
            </div>
        </div>
    );
}

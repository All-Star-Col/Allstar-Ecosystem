import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import {
    Table,
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
    getRowEditState?: (row: DataViewerRow) => { enabled: boolean; reason?: string };
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

function CellRenderer({ value }: { value: unknown }) {
    const cellType = getColumnType(value);

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">null</span>;
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
            return <span className="text-foreground">{DATE_FORMATTER.format(parsed)}</span>;
        }
    }

    if (cellType === "email") {
        return <span className="text-primary">{String(value)}</span>;
    }

    return (
        <span className="truncate block max-w-[220px]" title={String(value)}>
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
        return <ArrowUpDown className="w-3.5 h-3.5 text-primary-foreground/60" />;
    }

    if (sort.direction === "asc") {
        return <ArrowUp className="w-3.5 h-3.5 text-accent" />;
    }

    return <ArrowDown className="w-3.5 h-3.5 text-accent" />;
}

function getStableRowKey(row: DataViewerRow, rowIndex: number, tableLabel: string): string {
    const preferredKeys = ["id", "uuid", "code"];

    for (const key of preferredKeys) {
        const value = row[key];
        if (typeof value === "string" || typeof value === "number") {
            return `${tableLabel}-${key}-${value}`;
        }
    }

    return `${tableLabel}-${rowIndex}`;
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

    const handleSortToggle = (column: string) => {
        if (!sort || sort.column !== column) {
            onSortChange({ column, direction: "asc" });
            return;
        }

        if (sort.direction === "asc") {
            onSortChange({ column, direction: "desc" });
            return;
        }

        onSortChange(null);
    };

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-card rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">No hay registros</h3>
                    <p className="text-sm text-muted-foreground">
                        La tabla {tableLabel || "seleccionada"} no contiene datos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-card rounded-lg shadow-sm border border-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/80 [&_tr]:border-b-0">
                        <tr>
                            {visibleColumnKeys.map((columnKey) => (
                                <TableHead
                                    key={columnKey}
                                    className="text-foreground px-4 py-3"
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSortToggle(columnKey)}
                                        className="text-foreground hover:bg-primary/5 hover:text-foreground"
                                    >
                                        <span>{humanizeColumnName(columnKey)}</span>
                                        <SortIcon column={columnKey} sort={sort} />
                                    </Button>
                                </TableHead>
                            ))}
                            {showEditColumn && (
                                <TableHead className="text-foreground px-4 py-3 text-right">
                                    Acciones
                                </TableHead>
                            )}
                        </tr>
                    </TableHeader>

                    <TableBody>
                        {rows.map((row, rowIndex) => (
                            <TableRow
                                key={getStableRowKey(row, rowIndex, tableLabel)}
                                className="hover:bg-accent/10"
                            >
                                {visibleColumnKeys.map((columnKey) => (
                                    <TableCell
                                        key={`${rowIndex}-${columnKey}`}
                                        className="px-4 py-3 text-[13px] text-foreground"
                                    >
                                        <CellRenderer value={row[columnKey]} />
                                    </TableCell>
                                ))}
                                {showEditColumn && (
                                    <TableCell className="px-4 py-3 text-right">
                                        {(() => {
                                            const editState = getRowEditState?.(row) ?? {
                                                enabled: true,
                                            };
                                            return (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onEditRow?.(row)}
                                                    disabled={!editState.enabled}
                                                    title={
                                                        editState.enabled
                                                            ? "Editar fila"
                                                            : editState.reason
                                                    }
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    Editar
                                                </Button>
                                            );
                                        })()}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

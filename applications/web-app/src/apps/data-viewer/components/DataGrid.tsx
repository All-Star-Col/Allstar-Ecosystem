import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
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
        return <span className="text-gray-400 italic">null</span>;
    }

    if (cellType === "boolean") {
        return (
            <Switch.Root
                checked={Boolean(value)}
                className="w-10 h-5 bg-gray-300 rounded-full relative data-[state=checked]:bg-[#b69559] outline-none cursor-default"
            >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
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
            return <span className="text-gray-700">{DATE_FORMATTER.format(parsed)}</span>;
        }
    }

    if (cellType === "email") {
        return <span className="text-blue-600">{String(value)}</span>;
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
        return <ArrowUpDown className="w-3.5 h-3.5 text-white/60" />;
    }

    if (sort.direction === "asc") {
        return <ArrowUp className="w-3.5 h-3.5 text-[#b69559]" />;
    }

    return <ArrowDown className="w-3.5 h-3.5 text-[#b69559]" />;
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
            <div className="flex items-center justify-center h-full bg-white rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">No hay registros</h3>
                    <p className="text-sm text-gray-500">
                        La tabla {tableLabel || "seleccionada"} no contiene datos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
                <table className="min-w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#122337] text-white">
                        <tr>
                            {visibleColumnKeys.map((columnKey) => (
                                <th
                                    key={columnKey}
                                    className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap"
                                >
                                    <button
                                        onClick={() => handleSortToggle(columnKey)}
                                        className="flex items-center gap-2 hover:text-[#b69559] transition-colors"
                                    >
                                        <span>{humanizeColumnName(columnKey)}</span>
                                        <SortIcon column={columnKey} sort={sort} />
                                    </button>
                                </th>
                            ))}
                            {showEditColumn && (
                                <th className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap">
                                    Acciones
                                </th>
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr
                                key={getStableRowKey(row, rowIndex, tableLabel)}
                                className="border-b border-gray-100 hover:bg-[#b69559]/10 transition-colors"
                            >
                                {visibleColumnKeys.map((columnKey) => (
                                    <td
                                        key={`${rowIndex}-${columnKey}`}
                                        className="px-4 py-3 text-[13px] text-gray-800 whitespace-nowrap"
                                    >
                                        <CellRenderer value={row[columnKey]} />
                                    </td>
                                ))}
                                {showEditColumn && (
                                    <td className="px-4 py-3 text-right">
                                        {(() => {
                                            const editState = getRowEditState?.(row) ?? {
                                                enabled: true,
                                            };
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => onEditRow?.(row)}
                                                    disabled={!editState.enabled}
                                                    title={
                                                        editState.enabled
                                                            ? "Editar fila"
                                                            : editState.reason
                                                    }
                                                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    Editar
                                                </button>
                                            );
                                        })()}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

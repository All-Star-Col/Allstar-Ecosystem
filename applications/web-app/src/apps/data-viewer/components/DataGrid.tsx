import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import { getColumnType, humanizeColumnName } from "../data/columnUtils";
import type { DataViewerRow } from "../types";

interface DataGridProps {
    data: DataViewerRow[];
    tableName: string;
    globalFilter: string;
    visibleColumns: Set<string>;
    onFilteredCountChange?: (count: number) => void;
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
    columnKey: string | null;
    direction: SortDirection;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

function asComparableValue(value: unknown): number | string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "string") {
        const possibleDate = Date.parse(value);
        if (!Number.isNaN(possibleDate) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return possibleDate;
        }
        return value.toLowerCase();
    }
    return String(value).toLowerCase();
}

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

function SortIcon({ direction }: { direction: SortDirection }) {
    if (!direction) {
        return <ArrowUpDown className="w-3.5 h-3.5 text-white/60" />;
    }
    if (direction === "asc") {
        return <ArrowUp className="w-3.5 h-3.5 text-[#b69559]" />;
    }
    return <ArrowDown className="w-3.5 h-3.5 text-[#b69559]" />;
}

export function DataGrid({
    data,
    tableName,
    globalFilter,
    visibleColumns,
    onFilteredCountChange,
}: DataGridProps) {
    const [sortState, setSortState] = useState<SortState>({
        columnKey: null,
        direction: null,
    });

    const columnKeys = useMemo(() => {
        if (data.length === 0) return [];
        return Object.keys(data[0]).filter((key) =>
            visibleColumns.has(humanizeColumnName(key)),
        );
    }, [data, visibleColumns]);

    const rows = useMemo(() => {
        let nextRows = data;
        const query = globalFilter.trim().toLowerCase();

        if (query.length > 0) {
            nextRows = nextRows.filter((row) =>
                columnKeys.some((columnKey) => {
                    const value = row[columnKey];
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(query);
                }),
            );
        }

        if (!sortState.columnKey || !sortState.direction) {
            return nextRows;
        }

        const orderedRows = [...nextRows].sort((a, b) => {
            const left = asComparableValue(a[sortState.columnKey as string]);
            const right = asComparableValue(b[sortState.columnKey as string]);

            if (left < right) return sortState.direction === "asc" ? -1 : 1;
            if (left > right) return sortState.direction === "asc" ? 1 : -1;
            return 0;
        });

        return orderedRows;
    }, [columnKeys, data, globalFilter, sortState.columnKey, sortState.direction]);

    useEffect(() => {
        onFilteredCountChange?.(rows.length);
    }, [onFilteredCountChange, rows.length]);

    const toggleSort = (columnKey: string) => {
        setSortState((current) => {
            if (current.columnKey !== columnKey) {
                return { columnKey, direction: "asc" };
            }
            if (current.direction === "asc") {
                return { columnKey, direction: "desc" };
            }
            return { columnKey: null, direction: null };
        });
    };

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-white rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">No hay registros</h3>
                    <p className="text-sm text-gray-500">
                        La tabla {tableName || "seleccionada"} no contiene datos.
                    </p>
                </div>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-white rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Sin resultados</h3>
                    <p className="text-sm text-gray-500">
                        Ajusta el filtro global para encontrar informacion.
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
                            {columnKeys.map((columnKey) => (
                                <th
                                    key={columnKey}
                                    className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap"
                                >
                                    <button
                                        onClick={() => toggleSort(columnKey)}
                                        className="flex items-center gap-2 hover:text-[#b69559] transition-colors"
                                    >
                                        <span>{humanizeColumnName(columnKey)}</span>
                                        <SortIcon
                                            direction={
                                                sortState.columnKey === columnKey
                                                    ? sortState.direction
                                                    : null
                                            }
                                        />
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr
                                key={`${tableName}-${rowIndex}`}
                                className="border-b border-gray-100 hover:bg-[#b69559]/10 transition-colors"
                            >
                                {columnKeys.map((columnKey) => (
                                    <td
                                        key={`${rowIndex}-${columnKey}`}
                                        className="px-4 py-3 text-[13px] text-gray-800 whitespace-nowrap"
                                    >
                                        <CellRenderer value={row[columnKey]} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

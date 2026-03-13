import { useEffect, useMemo, useState } from "react";
import { Search, Database, Filter } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/shared/ui/sonner";
import { Sidebar } from "./Sidebar";
import { DataGrid } from "./DataGrid";
import { DataToolbar } from "./DataToolbar";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { mockTables } from "../data/mockData";
import { humanizeColumnName } from "../data/columnUtils";
import type { DataViewerModuleProps, DataViewerTable } from "../types";

function getInitialTableName(
    tables: DataViewerTable[],
    preferred?: string,
): string {
    if (preferred && tables.some((table) => table.name === preferred)) {
        return preferred;
    }
    return tables[0]?.name ?? "";
}

export function DataViewerProModule({
    tables = mockTables,
    initialTableName,
    title = "Data Viewer Pro",
    subtitle = "Gestion de datos",
    className,
    style,
    onBack,
    onTableChange,
    onRefresh,
    showBackButton = true,
}: DataViewerModuleProps) {
    const [activeTableName, setActiveTableName] = useState(() =>
        getInitialTableName(tables, initialTableName),
    );
    const [globalFilter, setGlobalFilter] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [filteredCount, setFilteredCount] = useState(0);

    useEffect(() => {
        setActiveTableName((currentTableName) => {
            if (tables.some((table) => table.name === currentTableName)) {
                return currentTableName;
            }
            return getInitialTableName(tables, initialTableName);
        });
    }, [initialTableName, tables]);

    const activeTable = useMemo(
        () => tables.find((table) => table.name === activeTableName),
        [activeTableName, tables],
    );
    const data = useMemo(() => activeTable?.data ?? [], [activeTable]);

    const allColumns = useMemo(() => {
        if (data.length === 0) return [];
        return Object.keys(data[0]).map(humanizeColumnName);
    }, [data]);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
        () => new Set(allColumns),
    );

    useEffect(() => {
        setVisibleColumns(new Set(allColumns));
    }, [allColumns]);

    const toggleColumn = (columnId: string) => {
        setVisibleColumns((previous) => {
            const next = new Set(previous);
            if (next.has(columnId)) {
                next.delete(columnId);
            } else {
                next.add(columnId);
            }
            return next;
        });
    };

    const exportToCSV = () => {
        if (data.length === 0) {
            toast.error("No hay datos para exportar");
            return;
        }

        try {
            const headers = Object.keys(data[0])
                .filter((key) => visibleColumns.has(humanizeColumnName(key)))
                .map(humanizeColumnName);

            const csvRows: string[] = [];
            csvRows.push(headers.join(","));

            data.forEach((row) => {
                const values = Object.keys(row)
                    .filter((key) => visibleColumns.has(humanizeColumnName(key)))
                    .map((key) => {
                        const value = row[key];
                        if (value === null || value === undefined) return "";
                        const stringValue = String(value);
                        if (stringValue.includes(",") || stringValue.includes("\"")) {
                            return `"${stringValue.replace(/"/g, "\"\"")}"`;
                        }
                        return stringValue;
                    });
                csvRows.push(values.join(","));
            });

            const csvContent = csvRows.join("\n");
            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            const safeTableName = activeTableName || "tabla";
            const dateText = new Date().toISOString().split("T")[0];
            link.setAttribute("download", `${safeTableName}_${dateText}.csv`);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Archivo CSV exportado");
        } catch {
            toast.error("No fue posible exportar el archivo");
        }
    };

    const handleRefresh = async () => {
        setIsLoading(true);
        toast.info("Actualizando datos...");

        try {
            if (onRefresh && activeTable) {
                await onRefresh(activeTable);
            } else {
                await new Promise((resolve) => {
                    setTimeout(resolve, 700);
                });
            }
            toast.success("Datos actualizados");
        } catch {
            toast.error("No fue posible actualizar los datos");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTableSelect = (tableName: string) => {
        setActiveTableName(tableName);
        setGlobalFilter("");
        const selectedTable = tables.find((table) => table.name === tableName);
        if (selectedTable) {
            onTableChange?.(selectedTable);
        }
    };

    return (
        <div
            className={`data-viewer-pro-module flex h-full min-h-[600px] overflow-hidden bg-[#f6f5f0] ${className ?? ""}`}
            style={style}
        >
            <Toaster position="top-right" richColors />

            <Sidebar
                tables={tables.map((table) => ({
                    name: table.name,
                    displayName: table.displayName,
                }))}
                title={title}
                subtitle={subtitle}
                activeTable={activeTableName}
                onTableSelect={handleTableSelect}
                onBack={onBack}
                showBackButton={showBackButton}
            />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="flex items-center justify-between mb-4 gap-6">
                        <div>
                            <div className="flex items-center gap-3">
                                <Database className="w-6 h-6 text-[#122337]" />
                                <h1 className="text-2xl font-semibold text-gray-900">
                                    {activeTable?.displayName ??
                                        "No hay tablas disponibles"}
                                </h1>
                            </div>

                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm text-gray-500">
                                    {data.length.toLocaleString("es-CO")}{" "}
                                    {data.length === 1 ? "registro" : "registros"} en
                                    total
                                </p>
                                {globalFilter &&
                                    filteredCount > 0 &&
                                    filteredCount !== data.length && (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#b69559]/10 border border-[#b69559]/30 rounded-full">
                                            <Filter className="w-3.5 h-3.5 text-[#b69559]" />
                                            <span className="text-xs font-medium text-[#b69559]">
                                                {filteredCount.toLocaleString(
                                                    "es-CO",
                                                )}{" "}
                                                filtrados
                                            </span>
                                        </div>
                                    )}
                            </div>
                        </div>

                        <DataToolbar
                            onExportCSV={exportToCSV}
                            onRefresh={handleRefresh}
                            columns={allColumns}
                            visibleColumns={visibleColumns}
                            onToggleColumn={toggleColumn}
                        />
                    </div>

                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar en todos los campos..."
                            value={globalFilter}
                            onChange={(event) =>
                                setGlobalFilter(event.target.value)
                            }
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-11 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#122337] focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-8 min-h-0">
                    {isLoading ? (
                        <LoadingSkeleton />
                    ) : (
                        <DataGrid
                            data={data}
                            tableName={activeTableName}
                            globalFilter={globalFilter}
                            visibleColumns={visibleColumns}
                            onFilteredCountChange={setFilteredCount}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

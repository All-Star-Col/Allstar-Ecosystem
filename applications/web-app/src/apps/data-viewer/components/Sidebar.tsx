import { Search, Database, ArrowLeft, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";

interface SidebarTableItem {
    id: string;
    displayName: string;
    technicalName: string;
    disabledReason?: string;
}

interface SidebarProps {
    tables: SidebarTableItem[];
    title?: string;
    subtitle?: string;
    activeTable: string;
    onTableSelect: (tableId: string) => void;
    onBack?: () => void;
    showBackButton?: boolean;
}

export function Sidebar({
    tables,
    title = "Data Viewer Pro",
    subtitle = "Gestion de Datos",
    activeTable,
    onTableSelect,
    onBack,
    showBackButton = true,
}: SidebarProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredTables = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        if (!normalizedQuery) {
            return tables;
        }

        return tables.filter((table) => {
            return (
                table.displayName.toLowerCase().includes(normalizedQuery) ||
                table.technicalName.toLowerCase().includes(normalizedQuery) ||
                table.id.toLowerCase().includes(normalizedQuery)
            );
        });
    }, [searchQuery, tables]);

    const handleBack = () => {
        if (onBack) {
            onBack();
            return;
        }

        window.history.back();
    };

    return (
        <div className="w-72 h-full min-h-0 bg-[#2f3339] text-white flex flex-col">
            {showBackButton && (
                <button
                    className="flex items-center gap-3 px-6 py-4 bg-[#122337] hover:bg-[#1a3351] transition-colors"
                    onClick={handleBack}
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm">Volver al Dashboard</span>
                </button>
            )}

            <div className="px-6 py-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <Database className="w-6 h-6 text-[#b69559]" />
                    <div>
                        <h1 className="text-lg font-semibold">{title}</h1>
                        <p className="text-xs text-white/60">{subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                        type="text"
                        placeholder="Buscar tablas..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#b69559] focus:border-transparent"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-1">
                    {filteredTables.map((table) => {
                        const isActive = activeTable === table.id;
                        const isBlocked = Boolean(table.disabledReason);

                        return (
                            <button
                                key={table.id}
                                onClick={() => onTableSelect(table.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                    isActive
                                        ? "bg-[#122337] text-white shadow-lg"
                                        : "text-white/70 hover:bg-white/5 hover:text-white"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium">
                                        {table.displayName}
                                    </span>
                                    <span className="text-xs text-white/40 truncate">
                                        {table.id}
                                    </span>
                                </div>
                                <p className="text-[11px] text-white/45 mt-1 truncate">
                                    {table.technicalName}
                                </p>
                                {isBlocked && (
                                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] text-amber-200">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Requiere ajuste backend</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {filteredTables.length === 0 && (
                    <div className="text-center py-8 text-white/40 text-sm">
                        No se encontraron tablas
                    </div>
                )}
            </div>

            <div className="px-6 py-4 border-t border-white/10">
                <p className="text-xs text-white/40">
                    {tables.length} {tables.length === 1 ? "tabla" : "tablas"} disponibles
                </p>
            </div>
        </div>
    );
}

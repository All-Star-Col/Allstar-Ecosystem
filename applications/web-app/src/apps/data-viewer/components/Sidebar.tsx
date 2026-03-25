import { Search, ArrowLeft, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/ui/utils";

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
        <div className="w-72 h-full min-h-0 bg-card/95 text-foreground flex flex-col border-r border-border/70 shadow-[12px_0_40px_rgba(18,35,55,0.04)]">
            {showBackButton && (
                <button
                    className="flex items-center gap-3 px-5 py-4 bg-primary/5 text-foreground hover:bg-primary/8 transition-colors border-b border-border/70"
                    onClick={handleBack}
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Volver al Dashboard</span>
                </button>
            )}

            <div className="inline-flex items-center justify-center px-5 py-5 pb-0">
                <div className="flex items-center justify-center text-center">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 py-4 border-b border-border/70">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Buscar tablas..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="pl-10 bg-background border-border/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring rounded-full"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                <div className="space-y-2">
                    {filteredTables.map((table) => {
                        const isActive = activeTable === table.id;
                        const isBlocked = Boolean(table.disabledReason);

                        return (
                            <button
                                key={table.id}
                                onClick={() => onTableSelect(table.id)}
                                className={cn(
                                    "w-full text-left px-4 py-3 rounded-xl transition-all border",
                                    isActive
                                        ? "bg-primary/8 text-foreground border-primary/25 shadow-sm"
                                        : "bg-card text-muted-foreground border-border/70 hover:bg-primary/5 hover:text-foreground",
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-inherit">
                                        {table.displayName}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                        {table.id}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                    {table.technicalName}
                                </p>
                                {isBlocked && (
                                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning/10 border border-warning/20 px-2 py-0.5 text-[11px] text-warning-foreground">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Requiere ajuste backend</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {filteredTables.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No se encontraron tablas
                    </div>
                )}
            </div>

            <div className="flex center-align justify-center center-text px-5 py-4 border-t border-border/70">
                <p className="text-xs text-muted-foreground">
                    {tables.length} {tables.length === 1 ? "tabla" : "tablas"} disponibles
                </p>
            </div>
        </div>
    );
}

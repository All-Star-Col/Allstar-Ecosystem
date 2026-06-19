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

const TABLE_GROUPS = [
    {
        key: "active",
        title: "Activo",
        order: [
            "ordenes de compra pendientes",
            "orden proceso pendiente",
            "items en proceso",
        ],
    },
    {
        key: "history",
        title: "Historial",
        order: [
            "ordenes de compra finalizadas",
            "items finalizados",
            "orden proceso finalizado",
            "orden proceso finalizados",
            "historial consumo material",
            "historial consumo tela",
        ],
    },
    {
        key: "general",
        title: "Datos generales",
        order: [],
    },
] as const;

type TableGroupKey = (typeof TABLE_GROUPS)[number]["key"];

function normalizeTableText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function getTableGroupKey(table: SidebarTableItem): TableGroupKey {
    const label = normalizeTableText(table.displayName);
    const id = normalizeTableText(table.id);

    if (
        id === "ordencompra_finalizadas" ||
        id === "items_finalizados" ||
        id === "ordenproceso_finalizados" ||
        id === "historialconsumomaterial" ||
        id === "historialconsumotela" ||
        label === "ordenes de compra finalizadas" ||
        label === "items finalizados" ||
        label === "orden proceso finalizado" ||
        label === "orden proceso finalizados" ||
        label === "historial consumo material" ||
        label === "historial consumo tela"
    ) {
        return "history";
    }

    if (
        id === "ordencompra" ||
        id === "items_en_proceso" ||
        id === "ordenproceso" ||
        label === "ordenes de compra pendientes" ||
        label === "orden proceso pendiente" ||
        label === "items en proceso"
    ) {
        return "active";
    }

    return "general";
}

function sortTablesInGroup(
    tables: SidebarTableItem[],
    order: readonly string[],
): SidebarTableItem[] {
    if (order.length === 0) {
        return tables;
    }

    const orderIndex = new Map(order.map((label, index) => [label, index]));
    return [...tables].sort((a, b) => {
        const aIndex = orderIndex.get(normalizeTableText(a.displayName)) ?? order.length;
        const bIndex = orderIndex.get(normalizeTableText(b.displayName)) ?? order.length;
        if (aIndex !== bIndex) {
            return aIndex - bIndex;
        }

        return a.displayName.localeCompare(b.displayName, "es");
    });
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

    const groupedTables = useMemo(() => {
        return TABLE_GROUPS.map((group) => {
            const groupTables = filteredTables.filter(
                (table) => getTableGroupKey(table) === group.key,
            );

            return {
                ...group,
                tables: sortTablesInGroup(groupTables, group.order),
            };
        }).filter((group) => group.tables.length > 0);
    }, [filteredTables]);

    const handleBack = () => {
        if (onBack) {
            onBack();
            return;
        }

        window.location.assign("/dashboard");
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
                <div className="space-y-5">
                    {groupedTables.map((group) => (
                        <section key={group.key} className="space-y-2">
                            <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {group.title}
                            </h2>
                            <div className="space-y-2">
                                {group.tables.map((table) => {
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
                                            <div className="flex items-center justify-center">
                                                <span className="text-sm font-medium text-inherit">
                                                    {table.displayName}
                                                </span>
                                            </div>
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
                        </section>
                    ))}
                </div>

                {filteredTables.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No se encontraron tablas
                    </div>
                )}
            </div>

            <div className="flex items-center justify-center text-center px-5 py-4 border-t border-border/70">
                <p className="text-xs text-muted-foreground">
                    {tables.length} {tables.length === 1 ? "tabla" : "tablas"} disponibles
                </p>
            </div>
        </div>
    );
}

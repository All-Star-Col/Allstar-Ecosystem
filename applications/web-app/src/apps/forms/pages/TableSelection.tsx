import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AlertCircle, ArrowLeft, Bot, Calculator, FileSpreadsheet, Loader2, Search } from "lucide-react";

import { CategoryAccordion } from "../components/CategoryAccordion";
import { SearchBar } from "../components/SearchBar";
import { fetchSalesAssistantStatus } from "../api";
import { useTables } from "../store";
import type { TableSchema } from "../schema";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";

const ALL_CATEGORY_ID = "__all__";
const MAIN_CATEGORY_ID = "__main__";

function normalizeTableText(value: string | undefined | null): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function isMainFormsTable(table: TableSchema): boolean {
    const normalizedName = normalizeTableText(table.name);
    const normalizedDisplay = normalizeTableText(table.displayName);
    const candidates = new Set([normalizedName, normalizedDisplay]);

    return (
        candidates.has("items") ||
        candidates.has("item") ||
        candidates.has("orden compra") ||
        candidates.has("orden de compra") ||
        candidates.has("ordenes compra") ||
        candidates.has("ordenes de compra") ||
        candidates.has("ordencompra") ||
        candidates.has("ordenescompra")
    );
}

export default function TableSelection() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
        MAIN_CATEGORY_ID,
    );
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
        {},
    );
    const [salesAssistantEnabled, setSalesAssistantEnabled] = useState(false);

    const { categories, tables, loading, error } = useTables();

    useEffect(() => {
        let cancelled = false;

        async function loadSalesAssistantStatus() {
            try {
                const status = await fetchSalesAssistantStatus();
                if (!cancelled) {
                    setSalesAssistantEnabled(Boolean(status.enabled));
                }
            } catch {
                if (!cancelled) {
                    setSalesAssistantEnabled(false);
                }
            }
        }

        void loadSalesAssistantStatus();

        return () => {
            cancelled = true;
        };
    }, []);

    const filteredTables = useMemo(() => {
        if (!searchQuery.trim()) return tables;

        const query = searchQuery.toLowerCase();
        return tables.filter(
            (table) =>
                table.displayName.toLowerCase().includes(query) ||
                table.name.toLowerCase().includes(query) ||
                table.description?.toLowerCase().includes(query),
        );
    }, [searchQuery, tables]);

    const mainTables = useMemo(
        () => filteredTables.filter(isMainFormsTable),
        [filteredTables],
    );

    const categoryBuckets = useMemo(() => {
        return categories
            .map((category) => ({
                category,
                tables: filteredTables.filter(
                    (table) => table.category === category.id,
                ),
            }))
            .sort((a, b) => {
                if (b.tables.length !== a.tables.length) {
                    return b.tables.length - a.tables.length;
                }

                return a.category.nombre.localeCompare(b.category.nombre);
            })
            .filter((bucket) => bucket.tables.length > 0);
    }, [categories, filteredTables]);

    const hasSelectedCategory = useMemo(
        () =>
            selectedCategoryId === ALL_CATEGORY_ID ||
            selectedCategoryId === MAIN_CATEGORY_ID ||
            categoryBuckets.some(
                (bucket) => bucket.category.id === selectedCategoryId,
            ),
        [categoryBuckets, selectedCategoryId],
    );

    const resolvedCategoryId = hasSelectedCategory
        ? selectedCategoryId
        : ALL_CATEGORY_ID;

    const visibleBuckets =
        resolvedCategoryId === MAIN_CATEGORY_ID
            ? [
                  {
                      category: {
                          id: MAIN_CATEGORY_ID,
                          nombre: "Principales",
                          description: "Items y ordenes de compra",
                      },
                      tables: mainTables,
                  },
              ].filter((bucket) => bucket.tables.length > 0)
            : resolvedCategoryId === ALL_CATEGORY_ID
            ? categoryBuckets
            : categoryBuckets.filter(
                  (bucket) => bucket.category.id === resolvedCategoryId,
              );

    const isCategoryOpen = (id: string) => openCategories[id] ?? true;

    const handleCategorySelect = (categoryId: string) => {
        setSelectedCategoryId(categoryId);

        if (categoryId !== ALL_CATEGORY_ID) {
            setOpenCategories((prev) => ({ ...prev, [categoryId]: true }));
        }
    };

    const handleAccordionToggle = (categoryId: string, open: boolean) => {
        setOpenCategories((prev) => ({ ...prev, [categoryId]: open }));
    };

    const renderCategoryFilterControls = () => {
        if (categoryBuckets.length === 0) {
            return null;
        }

        return (
            <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Categorías
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={
                            resolvedCategoryId === ALL_CATEGORY_ID
                                ? "rounded-full border-primary/25 bg-primary/10 text-foreground"
                                : "rounded-full"
                        }
                        onClick={() => handleCategorySelect(ALL_CATEGORY_ID)}
                    >
                        Todas
                        <span className="ml-2 text-xs tabular-nums opacity-80">
                            {filteredTables.length}
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={
                            resolvedCategoryId === MAIN_CATEGORY_ID
                                ? "rounded-full border-primary/25 bg-primary/10 text-foreground"
                                : "rounded-full"
                        }
                        onClick={() => handleCategorySelect(MAIN_CATEGORY_ID)}
                    >
                        Principales
                        <span className="ml-2 text-xs tabular-nums opacity-80">
                            {mainTables.length}
                        </span>
                    </Button>
                    {categoryBuckets.map((bucket) => {
                        const isActive =
                            resolvedCategoryId === bucket.category.id;
                        return (
                            <Button
                                key={bucket.category.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    handleCategorySelect(bucket.category.id)
                                }
                                className={
                                    isActive
                                        ? "rounded-full border-primary/25 bg-primary/10 text-foreground"
                                        : "rounded-full"
                                }
                            >
                                {bucket.category.nombre}
                                <span className="ml-2 text-xs tabular-nums opacity-80">
                                    {bucket.tables.length}
                                </span>
                            </Button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const handleTableSelect = (table: TableSchema) => {
        navigate(`/app/forms/${table.id}`);
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/80 bg-card/80 backdrop-blur">
                <div className="container mx-auto max-w-5xl px-4 py-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate("/dashboard")}
                                className="text-foreground hover:bg-muted/60"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Volver
                            </Button>
                            <div className="h-8 w-px bg-border" aria-hidden />
                            <div>
                                <h1 className="text-2xl font-semibold leading-tight text-foreground">
                                    Añadir registro
                                </h1>

                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {salesAssistantEnabled && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate("/app/forms/sales-assistant")}
                                >
                                    <Bot className="mr-2 h-4 w-4" />
                                    Asistente IA OC
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigate("/app/forms/bulk/purchase-orders")}
                            >
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Carga masiva
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigate("/app/forms/cost-calculator")}
                            >
                                <Calculator className="mr-2 h-4 w-4" />
                                Calculadora costos
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-5xl px-4 py-8">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                        <p className="text-muted-foreground">Cargando tablas...</p>
                    </div>
                )}

                {error && !loading && (
                    <Alert variant="destructive" className="max-w-2xl mx-auto">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            {error}
                            <br />
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => window.location.reload()}
                            >
                                Reintentar
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {!loading && !error && (
                    <div className="flex flex-col gap-6 md:flex-row md:items-start">
                        <section className="min-w-0 flex-1">
                            <div className="mb-6 space-y-4 md:hidden">
                                <SearchBar value={searchQuery} onChange={setSearchQuery} />
                                <div className="rounded-xl border border-border/80 bg-card/80 p-3">
                                    {renderCategoryFilterControls()}
                                </div>
                            </div>


                            {filteredTables.length === 0 ? (
                                <div className="text-center py-16">
                                    <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-xl mb-2">
                                        No se encontraron tablas
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Intenta con otros términos de búsqueda
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="space-y-4">
                                        {visibleBuckets.map((bucket) => (
                                            <CategoryAccordion
                                                key={bucket.category.id}
                                                category={bucket.category}
                                                tables={bucket.tables}
                                                onTableSelect={handleTableSelect}
                                                isOpen={isCategoryOpen(
                                                    bucket.category.id,
                                                )}
                                                onOpenChange={(open) =>
                                                    handleAccordionToggle(
                                                        bucket.category.id,
                                                        open,
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        <aside className="hidden w-full shrink-0 md:block md:w-80 md:sticky md:top-6">
                            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                                <div className="text-sm text-muted-foreground mb-3">
                                    Buscar
                                </div>
                                <SearchBar
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                />

                                <div className="my-4 h-px bg-border" aria-hidden />
                                {renderCategoryFilterControls()}
                            </div>
                        </aside>
                    </div>
                )}
            </main>
        </div>
    );
}

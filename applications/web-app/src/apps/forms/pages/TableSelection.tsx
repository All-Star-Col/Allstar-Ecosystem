import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AlertCircle, ArrowLeft, Loader2, Search } from "lucide-react";

import { CategoryAccordion } from "../components/CategoryAccordion";
import { SearchBar } from "../components/SearchBar";
import { useTables } from "../store";
import type { TableSchema } from "../schema";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";

export default function TableSelection() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");

    const { categories, tables, loading, error } = useTables();

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

    const handleTableSelect = (table: TableSchema) => {
        navigate(`/app/forms/${table.id}`);
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="bg-primary text-primary-foreground shadow-md">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/dashboard")}
                            className="text-primary-foreground hover:bg-primary-foreground/10"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Button>
                    </div>
                    <div>
                        <h1 className="text-3xl mb-2">
                            <b>Añadir registro</b>
                        </h1>
                        <p className="text-primary-foreground/80">
                            Seleccione una tabla
                        </p>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
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
                            <div className="mb-6 md:hidden">
                                <SearchBar
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                />
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
                                <div className="space-y-6">
                                    {categories.map((category) => {
                                        const categoryTables = filteredTables.filter(
                                            (table) =>
                                                table.category === category.id,
                                        );

                                        if (categoryTables.length === 0) return null;

                                        return (
                                            <CategoryAccordion
                                                key={category.id}
                                                category={category}
                                                tables={categoryTables}
                                                onTableSelect={handleTableSelect}
                                            />
                                        );
                                    })}
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
                            </div>
                        </aside>
                    </div>
                )}
            </main>
        </div>
    );
}

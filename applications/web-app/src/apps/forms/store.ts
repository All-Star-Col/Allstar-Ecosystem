import { createContext, useContext, useState, useEffect, createElement } from "react";
import { fetchCategories, fetchTables } from "./api";
import { mapAPICategory, mapAPITable } from "./schema";
import type { ReactNode } from "react";
import type { Category, TableSchema } from "./schema";

const FORMS_CACHE_KEY = "forms:tables-cache:v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

interface EndpointCacheMeta {
    etag: string | null;
    lastModified: string | null;
    fetchedAt: number;
}

interface FormsCache {
    categories: Category[];
    tables: TableSchema[];
    meta: {
        categories: EndpointCacheMeta;
        tables: EndpointCacheMeta;
    };
}

interface TablesContextType {
    categories: Category[];
    tables: TableSchema[];
    loading: boolean;
    error: string | null;
    getTableById: (id: string) => TableSchema | undefined;
    getCategoryById: (id: string) => Category | undefined;
}

const TablesContext = createContext<TablesContextType | undefined>(undefined);

function defaultMeta(): EndpointCacheMeta {
    return {
        etag: null,
        lastModified: null,
        fetchedAt: 0,
    };
}

function parseCache(rawCache: string | null): FormsCache | null {
    if (!rawCache) return null;

    try {
        const parsed = JSON.parse(rawCache) as FormsCache;
        if (
            !Array.isArray(parsed.categories) ||
            !Array.isArray(parsed.tables) ||
            !parsed.meta?.categories ||
            !parsed.meta?.tables
        ) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function isFresh(meta: EndpointCacheMeta): boolean {
    return Date.now() - meta.fetchedAt < CACHE_TTL_MS;
}

export function TablesProvider({ children }: { children: ReactNode }) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [tables, setTables] = useState<TableSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            const cached = parseCache(localStorage.getItem(FORMS_CACHE_KEY));
            const categoryMeta = cached?.meta.categories ?? defaultMeta();
            const tableMeta = cached?.meta.tables ?? defaultMeta();

            // Hydrate from cache first for instant render on refresh.
            if (cached) {
                setCategories(cached.categories);
                setTables(cached.tables);
                setLoading(false);
            }

            const hasValidators =
                Boolean(categoryMeta.etag || categoryMeta.lastModified) &&
                Boolean(tableMeta.etag || tableMeta.lastModified);
            const isFullyFresh = isFresh(categoryMeta) && isFresh(tableMeta);

            // TTL fallback when backend does not provide validators.
            if (cached && isFullyFresh && !hasValidators) {
                console.log('until here')
                return;
            }
            try {
                if (!cached) {
                    setLoading(true);
                }
                setError(null);
                const [categoriesResponse, tablesResponse] = await Promise.all([
                    fetchCategories({
                        etag: categoryMeta.etag,
                        lastModified: categoryMeta.lastModified,
                    }),
                    fetchTables({
                        etag: tableMeta.etag,
                        lastModified: tableMeta.lastModified,
                    }),
                ]);

                const mappedCategories = categoriesResponse.notModified
                    ? (cached?.categories ?? []) // only replace when null or undefined
                    : (categoriesResponse.data ?? []).map(mapAPICategory);
                const mappedTables = tablesResponse.notModified
                    ? (cached?.tables ?? [])
                    : (tablesResponse.data ?? []).map(mapAPITable);

                setCategories(mappedCategories);
                setTables(mappedTables);

                const updatedCache: FormsCache = {
                    categories: mappedCategories,
                    tables: mappedTables,
                    meta: {
                        categories: {
                            etag:
                                categoriesResponse.etag ??
                                categoryMeta.etag ??
                                null,
                            lastModified:
                                categoriesResponse.lastModified ??
                                categoryMeta.lastModified ??
                                null,
                            fetchedAt: Date.now(),
                        },
                        tables: {
                            etag: tablesResponse.etag ?? tableMeta.etag ?? null,
                            lastModified:
                                tablesResponse.lastModified ??
                                tableMeta.lastModified ??
                                null,
                            fetchedAt: Date.now(),
                        },
                    },
                };

                localStorage.setItem(
                    FORMS_CACHE_KEY,
                    JSON.stringify(updatedCache),
                );
            } catch (err) {
                console.error("❌ [Context] Error loading data:", err);

                // If cache exists, keep stale data visible and avoid blocking UI.
                if (!cached) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Error al cargar los datos",
                    );
                }
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    useEffect(() => {
        console.log("[TablesProvider] state categories:", categories);
    }, [categories])

    const getTableById = (id: string): TableSchema | undefined => {
        return tables.find((table) => table.id === id);
    };

    const getCategoryById = (id: string): Category | undefined => {
        return categories.find((cat) => cat.id === id);
    };

    return createElement(
        TablesContext.Provider,
        {
            value: {
                categories,
                tables,
                loading,
                error,
                getTableById,
                getCategoryById,
            },
        },
        children,
    );
}

export function useTables() {
    const context = useContext(TablesContext);
    if (context === undefined) {
        throw new Error("useTables must be used within a TablesProvider");
    }
    return context;
}

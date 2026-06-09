import { API_SERVER } from "@/config/api";
import { getToken } from "@/core/auth/auth.service";

// API Response Types
export interface CategoriesFormsAPI {
    id: number;
    nombre: string;
}

export interface ColumnTableAPI {
    name: string;
    type: string;
    nullable?: boolean | null;
    required?: boolean | null;
    max_length?: number | null;
    default_value?: any;
    enum_values?: string[] | null;
    foreign_key?: boolean | null;
    foreign_key_table?: string | null;
    foreign_key_value_field?: string | null;
    foreign_key_label_field?: string | null;
    foreign_key_options?: { value: string; label: string }[] | null;
}

export interface TableFormsAPI {
    id: number;
    name_sql: string;
    name_form: string;
    category_id: number;
    columns: ColumnTableAPI[];
}

export interface TableDataAPI {
    column: string;
    value: any;
}

export interface SubmitFormAPI {
    table_name: string;
    data: TableDataAPI[];
}

export interface BulkPurchaseOrderRowAPI {
    row_number: number;
    cliente: string;
    base: string;
    modelo: string;
    referencia: string;
    tela: string;
    oc_interno: string;
    oc_cliente: string;
    cantidad: number;
    product_name: string;
    resolved: Record<string, string | number | null | undefined>;
    suggested?: Record<string, string | null | undefined>;
    options?: Record<string, { id: string | number; label: string }[]>;
    missing: string[];
    status: "ready" | "needs_approval";
}

export interface BulkPurchaseOrderPreviewAPI {
    rows: BulkPurchaseOrderRowAPI[];
    summary: {
        total: number;
        ready: number;
        needs_approval: number;
    };
}

export interface BulkPurchaseOrderCommitAPI {
    status: string;
    created_orders: number;
    reused_orders: number;
    created_items: number;
    created_fabrics: number;
    created_products: number;
}

export interface RevalidateOptions {
    etag?: string | null;
    lastModified?: string | null;
}

export interface RevalidateResult<T> {
    data: T[] | null;
    etag: string | null;
    lastModified: string | null;
    notModified: boolean;
}

export interface RevalidateSingleResult<T> {
    data: T | null;
    etag: string | null;
    lastModified: string | null;
    notModified: boolean;
}

export interface ForeignKeyLookupOptionAPI {
    value: string;
    label: string;
}

export interface ForeignKeyLookupParams {
    tableName: string;
    columnName: string;
    query?: string;
    limit?: number;
}

function buildRevalidationHeaders(options?: RevalidateOptions): HeadersInit {
    const headers: HeadersInit = {};
    const token = getToken();

    if (options?.etag) {
        headers["If-None-Match"] = options.etag;
    }
    if (options?.lastModified) {
        headers["If-Modified-Since"] = options.lastModified;
    }
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}

function normalizeArrayPayload<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) {
        return payload as T[];
    }

    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        const candidates = [record.data, record.items, record.results];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate as T[];
            }
        }
    }

    return [];
}

async function fetchWithRevalidate<T>(
    url: string,
    options?: RevalidateOptions,
): Promise<RevalidateResult<T>> {
    const headers = buildRevalidationHeaders(options);

    const response = await fetch(url, { headers });

    if (response.status === 304) {
        return {
            data: null,
            etag: options?.etag ?? null,
            lastModified: options?.lastModified ?? null,
            notModified: true,
        };
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    const data = normalizeArrayPayload<T>(payload);

    return {
        data,
        etag: response.headers.get("ETag"),
        lastModified: response.headers.get("Last-Modified"),
        notModified: false,
    };
}

function normalizeSinglePayload<T>(payload: unknown): T | null {
    if (Array.isArray(payload)) {
        return payload.length > 0 ? (payload[0] as T) : null;
    }

    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        const candidates = [record.data, record.item, record.result];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate.length > 0 ? (candidate[0] as T) : null;
            }
            if (candidate && typeof candidate === "object") {
                return candidate as T;
            }
        }

        return payload as T;
    }

    return null;
}

function normalizeForeignKeyLookupPayload(
    payload: unknown,
): ForeignKeyLookupOptionAPI[] {
    const normalize = (input: unknown): ForeignKeyLookupOptionAPI[] => {
        if (!Array.isArray(input)) return [];

        return input
            .filter(
                (item) =>
                    item &&
                    typeof item === "object" &&
                    "value" in item &&
                    "label" in item,
            )
            .map((item) => {
                const option = item as { value: unknown; label: unknown };
                return {
                    value: String(option.value),
                    label: String(option.label),
                };
            });
    };

    if (Array.isArray(payload)) {
        return normalize(payload);
    }

    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        return normalize(
            record.options ?? record.data ?? record.items ?? record.results,
        );
    }

    return [];
}

/*
 * Fetch all available categories from the API
 */
export async function fetchCategories(
    options?: RevalidateOptions,
): Promise<RevalidateResult<CategoriesFormsAPI>> {
    try {
        return await fetchWithRevalidate<CategoriesFormsAPI>(
            `${API_SERVER}/workspace/forms/categories`,
            options,
        );
    } catch (error) {
        console.error("Error fetching categories:", error);
        throw error;
    }
}

/*
 * Fetch all available tables from the API
 */
export async function fetchTables(
    options?: RevalidateOptions,
): Promise<RevalidateResult<TableFormsAPI>> {
    try {
        return await fetchWithRevalidate<TableFormsAPI>(
            `${API_SERVER}/workspace/forms/tables`,
            options,
        );
    } catch (error) {
        console.error("Error fetching tables:", error);
        throw error;
    }
}

/*
 * Fetch metadata for a single table on-demand
 */
export async function fetchTableByName(
    tableName: string,
    options?: RevalidateOptions,
): Promise<RevalidateSingleResult<TableFormsAPI>> {
    const headers = buildRevalidationHeaders(options);
    const tablePath = encodeURIComponent(tableName);

    async function fallbackToTablesIndex(): Promise<RevalidateSingleResult<TableFormsAPI>> {
        const tablesResponse = await fetchTables(options);
        const table =
            tablesResponse.data?.find((item) => item.name_sql === tableName) ??
            null;

        return {
            data: table,
            etag: tablesResponse.etag,
            lastModified: tablesResponse.lastModified,
            notModified: tablesResponse.notModified,
        };
    }

    try {
        const response = await fetch(
            `${API_SERVER}/workspace/forms/tables/${tablePath}`,
            { headers },
        );

        if (response.status === 304) {
            return {
                data: null,
                etag: options?.etag ?? null,
                lastModified: options?.lastModified ?? null,
                notModified: true,
            };
        }

        if (response.status === 404 || response.status === 422 || response.status >= 500) {
            return await fallbackToTablesIndex();
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch table metadata: ${response.statusText}`);
        }

        const payload: unknown = await response.json();
        return {
            data: normalizeSinglePayload<TableFormsAPI>(payload),
            etag: response.headers.get("ETag"),
            lastModified: response.headers.get("Last-Modified"),
            notModified: false,
        };
    } catch (error) {
        try {
            return await fallbackToTablesIndex();
        } catch {
            throw error;
        }
    }
}

/*
 * Fetch foreign key options on-demand
 */
export async function fetchForeignKeyLookup(
    params: ForeignKeyLookupParams,
): Promise<ForeignKeyLookupOptionAPI[]> {
    const token = getToken();
    const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

    const searchParams = new URLSearchParams({
        table_name: params.tableName,
        column_name: params.columnName,
    });
    if (params.query) {
        searchParams.set("q", params.query);
    }
    if (params.limit) {
        searchParams.set("limit", String(params.limit));
    }

    const tablePath = encodeURIComponent(params.tableName);
    const columnPath = encodeURIComponent(params.columnName);
    const queryString = searchParams.toString();

    const candidateUrls = [
        `${API_SERVER}/workspace/forms/lookups/${tablePath}/${columnPath}${queryString ? `?${queryString}` : ""}`,
        `${API_SERVER}/workspace/forms/lookups/foreign-key?${searchParams.toString()}`,
        `${API_SERVER}/workspace/forms/foreign-key-lookup?${searchParams.toString()}`,
    ];

    let lastError: Error | null = null;

    for (const url of candidateUrls) {
        const response = await fetch(url, { headers });

        if (response.status === 404 || response.status === 405) {
            continue;
        }

        if (!response.ok) {
            const message = `Failed to fetch FK lookup: ${response.statusText}`;
            lastError = new Error(message);
            continue;
        }

        const payload: unknown = await response.json();
        return normalizeForeignKeyLookupPayload(payload);
    }

    throw (
        lastError ??
        new Error("Foreign key lookup endpoint is not available yet")
    );
}

/*
 * Fetch distinct existing values for a plain text column (used by HybridTextField)
 */
export async function fetchColumnValues(params: {
    tableName: string;
    columnName: string;
    query?: string;
    limit?: number;
}): Promise<{ value: string; label: string }[]> {
    const token = getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set("q", params.query);
    if (params.limit) searchParams.set("limit", String(params.limit));

    const tablePath = encodeURIComponent(params.tableName);
    const columnPath = encodeURIComponent(params.columnName);
    const queryString = searchParams.toString();
    const url = `${API_SERVER}/workspace/forms/column-values/${tablePath}/${columnPath}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch column values: ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    return normalizeForeignKeyLookupPayload(payload);
}

/*
 * Submit form data to the API
 */
export async function submitFormData(
    formData: SubmitFormAPI,
): Promise<{ status: string; correlation_id: string }> {
    try {
        const token = getToken();
        const response = await fetch(`${API_SERVER}/workspace/forms/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(formData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
                errorData.detail ||
                    `Failed to submit form: ${response.statusText}`,
            );
        }

        return await response.json();
    } catch (error) {
        console.error("Error submitting form:", error);
        throw error;
    }
}

export async function previewBulkPurchaseOrders(
    file: File,
): Promise<BulkPurchaseOrderPreviewAPI> {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
        `${API_SERVER}/workspace/forms/bulk/purchase-orders/preview`,
        {
            method: "POST",
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        },
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
            errorData?.detail || `No se pudo prevalidar el archivo: ${response.statusText}`,
        );
    }

    return (await response.json()) as BulkPurchaseOrderPreviewAPI;
}

export async function commitBulkPurchaseOrders(params: {
    rows: BulkPurchaseOrderRowAPI[];
    createMissing?: boolean;
}): Promise<BulkPurchaseOrderCommitAPI> {
    const token = getToken();
    const response = await fetch(
        `${API_SERVER}/workspace/forms/bulk/purchase-orders/commit`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                rows: params.rows,
                create_missing: params.createMissing ?? true,
            }),
        },
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
            errorData?.detail || `No se pudo cargar masivamente: ${response.statusText}`,
        );
    }

    return (await response.json()) as BulkPurchaseOrderCommitAPI;
}

/*
 * Fetch next consecutive numeric value for a given table/column
 */
export async function fetchNextConsecutive(
    tableName: string,
    columnName: string,
): Promise<{ next: number }> {
    const token = getToken();
    const headers: HeadersInit = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const url = `${API_SERVER}/workspace/forms/next-consecutive/${encodeURIComponent(
        tableName,
    )}/${encodeURIComponent(columnName)}`;

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
        throw new Error(`Failed to fetch next consecutive: ${resp.statusText}`);
    }
    return (await resp.json()) as { next: number };
}

/*
 * Fetch unassigned orders (orders without legacy item) for a table
 */
export async function fetchUnassignedOrders(params: {
    tableName: string;
    orderColumn: string;
    clientColumn: string;
    legacyColumn: string;
    q?: string | null;
    limit?: number;
    offset?: number;
}): Promise<{ items: { value: string; order?: string; label: string; client: string; product?: string; quantity?: string; count?: number }[]; has_more: boolean }>{
    const token = getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const searchParams = new URLSearchParams({
        table_name: params.tableName,
        order_column: params.orderColumn,
        client_column: params.clientColumn,
        legacy_column: params.legacyColumn,
    });
    if (params.q) searchParams.set("q", params.q);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));

    const url = `${API_SERVER}/workspace/forms/unassigned-orders?${searchParams.toString()}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
        throw new Error(`Failed to fetch unassigned orders: ${resp.statusText}`);
    }
    const payload = await resp.json();
    return payload as { items: { value: string; order?: string; label: string; client: string; product?: string; quantity?: string; count?: number }[]; has_more: boolean };
}

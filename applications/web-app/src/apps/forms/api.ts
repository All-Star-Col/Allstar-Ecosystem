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
    console.log("using table fetch");
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

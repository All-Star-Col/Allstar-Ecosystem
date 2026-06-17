import { API_SERVER } from "@/config/api";
import { getToken } from "@/core/auth/auth.service";
import type {
    DataViewerApiErrorBody,
    DataViewerErrorCode,
    DataViewerQueryRequest,
    DataViewerQueryResponse,
    DataViewerTable,
    DataViewerUpdateRowRequest,
    DataViewerUpdateRowResponse,
} from "./types";

const DATA_VIEWER_BASE = `${API_SERVER}/workspace/data-viewer`;

function createRequestId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `dv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractFilename(contentDisposition: string | null, fallback: string): string {
    if (!contentDisposition) {
        return fallback;
    }

    const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Name?.[1]) {
        return decodeURIComponent(utf8Name[1]);
    }

    const plainName = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (plainName?.[1]) {
        return plainName[1];
    }

    return fallback;
}

export class DataViewerApiError extends Error {
    status: number;
    code: DataViewerErrorCode | string;
    requestId: string;

    constructor(args: {
        status: number;
        code: DataViewerErrorCode | string;
        detail: string;
        requestId: string;
    }) {
        super(args.detail);
        this.name = "DataViewerApiError";
        this.status = args.status;
        this.code = args.code;
        this.requestId = args.requestId;
    }
}

async function toApiError(
    response: Response,
    fallbackRequestId: string,
): Promise<DataViewerApiError> {
    let detail = `Request failed with status ${response.status}`;
    let code: DataViewerErrorCode | string = "INTERNAL_ERROR";

    try {
        const body = (await response.json()) as DataViewerApiErrorBody;
        detail = body.detail ?? detail;
        code = body.code ?? code;

        return new DataViewerApiError({
            status: response.status,
            code,
            detail,
            requestId:
                body.request_id ??
                response.headers.get("X-Request-ID") ??
                fallbackRequestId,
        });
    } catch {
        return new DataViewerApiError({
            status: response.status,
            code,
            detail,
            requestId: response.headers.get("X-Request-ID") ?? fallbackRequestId,
        });
    }
}

function buildHeaders(
    headersInit: HeadersInit | undefined,
    options?: { contentTypeJson?: boolean },
): { headers: Headers; requestId: string } {
    const headers = new Headers(headersInit);

    if (options?.contentTypeJson && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const token = getToken();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const requestId = headers.get("X-Request-ID") ?? createRequestId();
    headers.set("X-Request-ID", requestId);

    return { headers, requestId };
}

export async function fetchDataViewerTables(options?: {
    signal?: AbortSignal;
}): Promise<{ tables: DataViewerTable[]; requestId: string }> {
    const { headers, requestId } = buildHeaders(undefined);

    const response = await fetch(`${DATA_VIEWER_BASE}/tables`, {
        method: "GET",
        headers,
        signal: options?.signal,
    });

    if (!response.ok) {
        throw await toApiError(response, requestId);
    }

    return {
        tables: (await response.json()) as DataViewerTable[],
        requestId: response.headers.get("X-Request-ID") ?? requestId,
    };
}

export async function queryDataViewer(
    payload: DataViewerQueryRequest,
    options?: { signal?: AbortSignal },
): Promise<{ result: DataViewerQueryResponse; requestId: string }> {
    const { headers, requestId } = buildHeaders(undefined, {
        contentTypeJson: true,
    });

    const response = await fetch(`${DATA_VIEWER_BASE}/query`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal,
    });

    if (!response.ok) {
        throw await toApiError(response, requestId);
    }

    return {
        result: (await response.json()) as DataViewerQueryResponse,
        requestId: response.headers.get("X-Request-ID") ?? requestId,
    };
}

export async function exportDataViewerExcel(
    payload: DataViewerQueryRequest,
    options?: { signal?: AbortSignal },
): Promise<{ blob: Blob; filename: string; requestId: string }> {
    const { headers, requestId } = buildHeaders(undefined, {
        contentTypeJson: true,
    });

    const response = await fetch(`${DATA_VIEWER_BASE}/export`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal,
    });

    if (!response.ok) {
        throw await toApiError(response, requestId);
    }

    const tableId = payload.table_id || "table";
    const fallbackFilename = `data_viewer_${tableId}_${new Date().toISOString()}.xls`;

    return {
        blob: await response.blob(),
        filename: extractFilename(
            response.headers.get("Content-Disposition"),
            fallbackFilename,
        ),
        requestId: response.headers.get("X-Request-ID") ?? requestId,
    };
}

export const exportDataViewerCsv = exportDataViewerExcel;

export async function updateDataViewerRow(
    payload: DataViewerUpdateRowRequest,
    options?: { signal?: AbortSignal },
): Promise<{ result: DataViewerUpdateRowResponse; requestId: string }> {
    const { headers, requestId } = buildHeaders(undefined, {
        contentTypeJson: true,
    });

    const response = await fetch(`${DATA_VIEWER_BASE}/rows`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal,
    });

    if (!response.ok) {
        throw await toApiError(response, requestId);
    }

    const result = (await response.json()) as DataViewerUpdateRowResponse;

    return {
        result,
        requestId:
            response.headers.get("X-Request-ID") ?? result.request_id ?? requestId,
    };
}

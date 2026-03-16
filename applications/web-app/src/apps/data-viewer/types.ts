import type { CSSProperties } from "react";

export type DataViewerRow = Record<string, unknown>;

export interface DataViewerColumn {
    name: string;
    type: string;
    nullable: boolean;
    visible: boolean;
}

export interface DataViewerTable {
    table_id: string;
    table_name: string;
    display_name: string;
    has_pk: boolean;
    stable_order_column: string | null;
    default_order_column: string | null;
    order_error_code: string | null;
    columns: DataViewerColumn[];
}

export type DataViewerSortDirection = "asc" | "desc";

export interface DataViewerSort {
    column: string;
    direction: DataViewerSortDirection;
}

export type DataViewerFilterOperator =
    | "eq"
    | "contains"
    | "gt"
    | "lt"
    | "in"
    | "between";

export interface DataViewerFilter {
    column: string;
    operator: DataViewerFilterOperator;
    value: unknown;
    value_to?: unknown;
}

export interface DataViewerQueryRequest {
    table_id: string;
    columns?: string[];
    filters?: DataViewerFilter[];
    sort?: DataViewerSort;
    q?: string;
    limit?: number;
    offset?: number;
    include_total?: boolean;
}

export interface DataViewerQueryResponse {
    rows: DataViewerRow[];
    total_count: number | null;
    limit: number;
    offset: number;
    has_more: boolean;
}

export type DataViewerErrorCode =
    | "INVALID_IDENTIFIER"
    | "INVALID_FILTER"
    | "UNSUPPORTED_OPERATOR"
    | "LIMIT_EXCEEDED"
    | "EXPORT_MAX_EXCEEDED"
    | "QUERY_TIMEOUT"
    | "INTERNAL_ERROR"
    | "TABLE_NOT_CONFIGURED"
    | "INVALID_Q_LENGTH"
    | "NO_STABLE_ORDER_COLUMN";

export interface DataViewerApiErrorBody {
    request_id?: string;
    detail?: string;
    code?: DataViewerErrorCode | string;
}

export interface DataViewerModuleProps {
    initialTableId?: string;
    title?: string;
    subtitle?: string;
    className?: string;
    style?: CSSProperties;
    onBack?: () => void;
    showBackButton?: boolean;
    defaultLimit?: number;
}

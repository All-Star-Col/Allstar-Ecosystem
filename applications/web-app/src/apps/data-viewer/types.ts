import type { CSSProperties } from "react";

export type DataViewerRow = Record<string, unknown>;
export type DataViewerPk = Record<string, string | number | boolean>;
export type DataViewerChanges = Record<string, unknown>;

export interface DataViewerColumn {
    name: string;
    type: string;
    nullable: boolean;
    visible: boolean;
    editable?: boolean;
    required?: boolean;
    max_length?: number | null;
    enum_values?: string[] | null;
    read_only_reason?: string | null;
    raw_value_column?: string | null;
}

export interface DataViewerTable {
    table_id: string;
    table_name: string;
    display_name: string;
    has_pk: boolean;
    stable_order_column: string | null;
    default_order_column: string | null;
    order_error_code: string | null;
    can_update?: boolean;
    can_insert?: boolean;
    can_delete?: boolean;
    can_release_order_process?: boolean;
    pk_columns?: string[] | null;
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
    | "between"
    | "is_null"
    | "is_not_null";

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

export interface DataViewerUpdateRowRequest {
    table_id: string;
    pk: DataViewerPk;
    changes: DataViewerChanges;
}

export interface DataViewerUpdateRowResponse {
    row: DataViewerRow;
    updated_columns: string[];
    request_id?: string;
}

export interface ProductMergeConflict {
    source_product_id: number;
    target_product_id: number;
    target_product_name: string;
    recalculated_name: string;
}

export interface ProductMergeResponse {
    status: string;
    deleted_product_id: number;
    target_product_id: number;
    target_product_name: string;
    updated_order_ids: Array<string | number>;
    updated_orders_count: number;
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
    | "NO_STABLE_ORDER_COLUMN"
    | "TABLE_NOT_EDITABLE"
    | "NO_PK_DEFINED"
    | "PK_REQUIRED"
    | "ROW_NOT_FOUND"
    | "COLUMN_NOT_EDITABLE"
    | "PRODUCT_MERGE_REQUIRED"
    | "VALIDATION_ERROR"
    | "CONFLICT_VERSION"
    | "CONCURRENCY_NOT_SUPPORTED";

export interface DataViewerApiErrorBody {
    request_id?: string;
    detail?: string;
    code?: DataViewerErrorCode | string;
    merge?: ProductMergeConflict;
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

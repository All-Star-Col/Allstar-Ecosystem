import type { CSSProperties } from "react";

export type DataViewerRow = Record<string, unknown>;

export interface DataViewerTable {
    name: string;
    displayName: string;
    data: DataViewerRow[];
}

export interface DataViewerModuleProps {
    tables?: DataViewerTable[];
    initialTableName?: string;
    title?: string;
    subtitle?: string;
    className?: string;
    style?: CSSProperties;
    onBack?: () => void;
    onTableChange?: (table: DataViewerTable) => void;
    onRefresh?: (table: DataViewerTable) => Promise<void> | void;
    showBackButton?: boolean;
}

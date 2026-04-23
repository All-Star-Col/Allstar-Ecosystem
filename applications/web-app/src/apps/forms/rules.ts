import type { ColumnSchema, TableSchema } from "./schema";

const HIDDEN_COLUMN_NAMES = new Set(["id", "timestamp"]);
const PRODUCT_TABLE_NAMES = new Set(["producto", "productos"]);
const MATERIAL_TELA_TABLE_NAMES = new Set([
    "material",
    "materiales",
    "tela",
    "telas",
]);

type NamedColumn = { name: string };

function normalizeIdentifier(value: string | undefined | null): string {
    return (value ?? "")
        .trim()
        .replace(/^"+|"+$/g, "")
        .toLowerCase();
}

function normalizeTableName(tableName: string | undefined): string {
    const normalized = normalizeIdentifier(tableName);
    if (!normalized) return "";

    const tableSegments = normalized
        .split(".")
        .map((segment) => normalizeIdentifier(segment))
        .filter(Boolean);

    return tableSegments[tableSegments.length - 1] ?? normalized;
}

export function isHiddenFormColumn(columnName: string): boolean {
    return HIDDEN_COLUMN_NAMES.has(normalizeIdentifier(columnName));
}

export function filterVisibleFormColumns<T extends { name: string }>(
    columns: T[],
): T[] {
    return columns.filter((column) => !isHiddenFormColumn(column.name));
}

export function resolveVisibleFieldCount(table: TableSchema): number {
    if (table.visibleColumnCount !== undefined) {
        return table.visibleColumnCount;
    }

    if (table.columns.length > 0) {
        return filterVisibleFormColumns(table.columns).length;
    }

    return table.columnCount ?? 0;
}

export function isBooleanEstadoColumn(columnName: string): boolean {
    return normalizeIdentifier(columnName) === "estado";
}

export function isProductTable(tableName?: string): boolean {
    return PRODUCT_TABLE_NAMES.has(normalizeTableName(tableName));
}

export function isProductDerivedColumnName(columnName: string): boolean {
    const normalizedColumn = normalizeIdentifier(columnName);
    return normalizedColumn === "sku" || normalizedColumn === "nombre";
}

function hasProductSegmentColumn(
    normalizedColumnNames: Set<string>,
    segment: "base" | "modelo" | "referencia" | "tela",
): boolean {
    return (
        normalizedColumnNames.has(segment) ||
        normalizedColumnNames.has(`id_${segment}`)
    );
}

export function isProductDerivationContext(
    tableName: string | undefined,
    columns: NamedColumn[],
): boolean {
    if (isProductTable(tableName)) {
        return true;
    }

    const normalizedColumnNames = new Set(
        columns.map((column) => normalizeIdentifier(column.name)),
    );
    if (
        !normalizedColumnNames.has("sku") ||
        !normalizedColumnNames.has("nombre")
    ) {
        return false;
    }

    return (
        hasProductSegmentColumn(normalizedColumnNames, "base") &&
        hasProductSegmentColumn(normalizedColumnNames, "modelo") &&
        hasProductSegmentColumn(normalizedColumnNames, "referencia") &&
        hasProductSegmentColumn(normalizedColumnNames, "tela")
    );
}

export function isProductDerivedColumn(
    tableName: string | undefined,
    columnName: string,
): boolean {
    if (!isProductTable(tableName)) {
        return false;
    }
    return isProductDerivedColumnName(columnName);
}

export function shouldUseHybridTextField(
    tableName: string | undefined,
    columnName: string,
): boolean {
    if (!MATERIAL_TELA_TABLE_NAMES.has(normalizeTableName(tableName))) {
        return false;
    }

    const normalizedColumn = normalizeIdentifier(columnName);
    return normalizedColumn === "nombre" || normalizedColumn === "referencia";
}

export function shouldUseJsonbPropertiesField(column: ColumnSchema): boolean {
    return (
        normalizeIdentifier(column.name) === "propiedades" &&
        normalizeIdentifier(column.type) === "jsonb"
    );
}

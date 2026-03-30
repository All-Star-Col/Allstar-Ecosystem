// Import API types
import type { CategoriesFormsAPI, TableFormsAPI, ColumnTableAPI } from "./api";

export type DataType =
    | "string"
    | "varchar"
    | "text"
    | "integer"
    | "bigint"
    | "decimal"
    | "float"
    | "boolean"
    | "date"
    | "datetime"
    | "timestamp"
    | "enum"
    | "foreign_key";

export interface ColumnSchema {
    name: string;
    displayName?: string;
    type: DataType;
    required?: boolean;
    nullable?: boolean;
    maxLength?: number;
    enumValues?: string[];
    foreignKeyOptions?: { value: string; label: string }[];
    foreignKeyTable?: string;
    foreignKeyValueField?: string;
    foreignKeyLabelField?: string;
    defaultValue?: any;
    placeholder?: string;
    hint?: string;
}

export interface TableSchema {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    category: string;
    columnCount?: number;
    columns: ColumnSchema[];
}

export interface Category {
    id: string;
    nombre: string;
    description?: string;
}

/**
 * Map database type string to DataType enum
 */
export function mapDatabaseTypeToDataType(dbType: string): DataType {
    const type = dbType.toLowerCase();

    // Handle VARCHAR, CHAR with length specifications
    if (type.includes("varchar") || type.includes("char")) return "varchar";
    if (type.includes("text")) return "text";

    // Integer types
    if (type.includes("int") || type.includes("serial")) return "integer";
    if (type.includes("bigint") || type.includes("bigserial")) return "bigint";

    // Decimal/Float types
    if (type.includes("decimal") || type.includes("numeric")) return "decimal";
    if (
        type.includes("float") ||
        type.includes("double") ||
        type.includes("real")
    )
        return "float";

    // Boolean
    if (type.includes("bool")) return "boolean";

    // Date/Time types
    if (type === "date") return "date";
    if (type.includes("timestamp")) return "timestamp";
    if (type.includes("datetime")) return "datetime";

    // Default to string for unknown types
    return "string";
}

/**
 * Map API Category to UI Category
 */
export function mapAPICategory(apiCategory: CategoriesFormsAPI): Category {
    return {
        id: apiCategory.id.toString(),
        nombre: apiCategory.nombre,
        description: undefined, // API doesn't provide description
    };
}

/**
 * Map API Column to UI ColumnSchema
 */
export function mapAPIColumn(apiColumn: ColumnTableAPI): ColumnSchema {
    const nullable = apiColumn.nullable ?? !(apiColumn.required ?? false);
    const required = !nullable || Boolean(apiColumn.required);
    const enumValues =
        apiColumn.enum_values?.filter((value) => value.trim() !== "") ?? [];
    const isForeignKey = Boolean(apiColumn.foreign_key);
    const displayNameParts = apiColumn.name.toLowerCase().split("_");
    const normalizedDisplayParts =
        isForeignKey &&
        displayNameParts.length > 1 &&
        displayNameParts[0] === "id"
            ? displayNameParts.slice(1)
            : displayNameParts;
    const foreignKeyOptions =
        apiColumn.foreign_key_options
            ?.filter(
                (option) =>
                    option &&
                    option.value !== undefined &&
                    option.value !== null &&
                    option.label !== undefined &&
                    option.label !== null,
            )
            .map((option) => ({
                value: String(option.value),
                label: String(option.label),
            })) ?? [];

    return {
        name: apiColumn.name,
        displayName: normalizedDisplayParts
            .map((part, index) => {
                if (part === "id") return "ID";
                if (index === 0)
                    return part.charAt(0).toUpperCase() + part.slice(1);
                return part;
            })
            .join(" "),
        type:
            isForeignKey
                ? "foreign_key"
                : enumValues.length > 0
                ? "enum"
                : mapDatabaseTypeToDataType(apiColumn.type),
        required,
        nullable,
        maxLength: apiColumn.max_length ?? undefined,
        defaultValue: apiColumn.default_value ?? undefined,
        enumValues: enumValues.length > 0 ? enumValues : undefined,
        foreignKeyOptions:
            foreignKeyOptions.length > 0 ? foreignKeyOptions : undefined,
        foreignKeyTable: apiColumn.foreign_key_table ?? undefined,
        foreignKeyValueField: apiColumn.foreign_key_value_field ?? undefined,
        foreignKeyLabelField: apiColumn.foreign_key_label_field ?? undefined,
    };
}

/**
 * Map API Table to lightweight UI TableSchema (without heavy columns payload)
 */
export function mapAPITableSummary(apiTable: TableFormsAPI): TableSchema {
    return {
        id: apiTable.id.toString(),
        name: apiTable.name_sql,
        displayName: apiTable.name_form,
        description: undefined,
        category: apiTable.category_id.toString(),
        columnCount: apiTable.columns?.length ?? 0,
        columns: [],
    };
}

/**
 * Map API Table to UI TableSchema
 */
export function mapAPITable(apiTable: TableFormsAPI): TableSchema {
    const columns = apiTable.columns.map(mapAPIColumn);
    return {
        id: apiTable.id.toString(),
        name: apiTable.name_sql,
        displayName: apiTable.name_form,
        description: undefined, // API doesn't provide description
        category: apiTable.category_id.toString(),
        columnCount: columns.length,
        columns,
    };
}

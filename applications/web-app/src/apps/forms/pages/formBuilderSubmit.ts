import type { TableDataAPI } from "../api";
import type { ColumnSchema } from "../schema";

export function normalizeSubmitValue(
    column: ColumnSchema,
    value: unknown,
): unknown {
    if (column.type !== "foreign_key") {
        return value;
    }

    if (value === undefined || value === null || value === "") {
        return value;
    }

    const valueAsString = String(value);
    const matchingOption = column.foreignKeyOptions?.find(
        (option) => option.label === valueAsString,
    );

    return matchingOption?.value ?? valueAsString;
}

export function buildSubmitData(
    visibleColumns: ColumnSchema[],
    formData: Record<string, unknown>,
): TableDataAPI[] {
    return visibleColumns
        .filter((column) => formData[column.name] !== undefined)
        .map((column) => ({
            column: column.name,
            value: normalizeSubmitValue(column, formData[column.name]),
        }));
}

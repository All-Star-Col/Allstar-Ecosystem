import type { TableDataAPI } from "../api";
import type { ColumnSchema } from "../schema";
import { isProductTable } from "../rules";
import { toProductSkuSubmit } from "./productDerivation";

interface SubmitBuildOptions {
    normalizeProductSku?: boolean;
}

export function normalizeSubmitValue(
    column: ColumnSchema,
    value: unknown,
    tableName?: string,
    options?: SubmitBuildOptions,
): unknown {
    if (
        (options?.normalizeProductSku || isProductTable(tableName)) &&
        column.name.toLowerCase() === "sku"
    ) {
        return toProductSkuSubmit(value);
    }

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
    tableName?: string,
    options?: SubmitBuildOptions,
): TableDataAPI[] {
    return visibleColumns
        .filter((column) => formData[column.name] !== undefined)
        .map((column) => ({
            column: column.name,
            value: normalizeSubmitValue(
                column,
                formData[column.name],
                tableName,
                options,
            ),
        }));
}

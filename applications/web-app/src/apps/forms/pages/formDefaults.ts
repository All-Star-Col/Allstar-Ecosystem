import type { ColumnSchema } from "../schema";

export function toIsoDate(date: Date = new Date()): string {
    return date.toISOString().split("T")[0] ?? "";
}

function normalizeColumnName(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

export function resolveInitialColumnValue(
    column: ColumnSchema,
    now: Date = new Date(),
): unknown {
    if (column.defaultValue !== undefined && column.defaultValue !== null) {
        return column.defaultValue;
    }

    if (column.type === "date") {
        const normalizedName = normalizeColumnName(column.name);
        if (normalizedName === "fecha_entrega") {
            return undefined;
        }
        return toIsoDate(now);
    }

    return undefined;
}

export function buildInitialFormData(
    columns: ColumnSchema[],
    now: Date = new Date(),
): Record<string, unknown> {
    return columns.reduce<Record<string, unknown>>((accumulator, column) => {
        const initialValue = resolveInitialColumnValue(column, now);
        if (initialValue !== undefined) {
            accumulator[column.name] = initialValue;
        }
        return accumulator;
    }, {});
}


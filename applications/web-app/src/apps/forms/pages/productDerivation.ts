import type { ColumnSchema } from "../schema";
import { isProductDerivationContext } from "../rules";

type ProductSegment = "base" | "modelo" | "referencia" | "tela";

interface ProductSegmentConfig {
    key: ProductSegment;
    width: number;
}

const PRODUCT_SEGMENTS: ProductSegmentConfig[] = [
    { key: "base", width: 3 },
    { key: "modelo", width: 3 },
    { key: "referencia", width: 4 },
    { key: "tela", width: 5 },
];

function normalizeColumnName(columnName: string): string {
    return columnName.trim().toLowerCase();
}

function findSegmentColumn(
    columns: ColumnSchema[],
    segment: ProductSegment,
): ColumnSchema | undefined {
    return columns.find((column) => {
        const normalizedName = normalizeColumnName(column.name);
        return normalizedName === segment || normalizedName === `id_${segment}`;
    });
}

function resolveSegmentRawValue(
    formData: Record<string, unknown>,
    column: ColumnSchema | undefined,
    segment: ProductSegment,
): unknown {
    if (column && formData[column.name] !== undefined) {
        return formData[column.name];
    }

    return formData[segment];
}

function normalizeLookupValue(
    column: ColumnSchema | undefined,
    rawValue: unknown,
): string {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return "";
    }

    const rawString = String(rawValue).trim();
    const options = column?.foreignKeyOptions;
    if (!options || options.length === 0) {
        return rawString;
    }

    const byValue = options.find((option) => option.value === rawString);
    if (byValue) {
        return byValue.value;
    }

    const byLabel = options.find((option) => option.label === rawString);
    if (byLabel) {
        return byLabel.value;
    }

    return rawString;
}

function resolveLookupLabel(
    column: ColumnSchema | undefined,
    rawValue: unknown,
    selectedLabel: string | undefined,
): string {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return "";
    }

    if (selectedLabel && selectedLabel.trim() !== "") {
        return selectedLabel.trim();
    }

    const rawString = String(rawValue).trim();
    const options = column?.foreignKeyOptions;
    if (!options || options.length === 0) {
        return rawString;
    }

    const byValue = options.find((option) => option.value === rawString);
    if (byValue) {
        return byValue.label;
    }

    const byLabel = options.find((option) => option.label === rawString);
    if (byLabel) {
        return byLabel.label;
    }

    return rawString;
}

function toPaddedNumericSegment(rawValue: string, width: number): string {
    const digits = rawValue.replace(/\D/g, "");
    if (!digits) {
        return "";
    }

    return digits.slice(-width).padStart(width, "0");
}

export function toProductSkuSubmit(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).replace(/\D/g, "");
}

function buildProductSkuDisplay(segments: string[]): string {
    if (segments.some((segment) => segment === "")) {
        return "";
    }

    return `1-${segments[0]}-${segments[1]}-${segments[2]}-${segments[3]}`;
}

export interface DerivedProductFields {
    sku: string;
    nombre: string;
}

export function deriveProductFields(
    tableName: string | undefined,
    columns: ColumnSchema[],
    formData: Record<string, unknown>,
    selectedLabelsByColumn: Record<string, string> = {},
): DerivedProductFields {
    if (!isProductDerivationContext(tableName, columns)) {
        return { sku: String(formData.sku ?? ""), nombre: String(formData.nombre ?? "") };
    }

    const labels: string[] = [];
    const skuSegments = PRODUCT_SEGMENTS.map(({ key, width }) => {
        const column = findSegmentColumn(columns, key);
        const rawValue = resolveSegmentRawValue(formData, column, key);
        const normalizedValue = normalizeLookupValue(column, rawValue);
        const label = resolveLookupLabel(
            column,
            rawValue,
            column ? selectedLabelsByColumn[column.name] : undefined,
        );

        if (label) {
            labels.push(label);
        }

        return toPaddedNumericSegment(normalizedValue, width);
    });

    return {
        sku: buildProductSkuDisplay(skuSegments),
        nombre: labels.join(" ").trim(),
    };
}

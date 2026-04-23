import type {
    DataViewerChanges,
    DataViewerColumn,
    DataViewerPk,
    DataViewerRow,
    DataViewerTable,
} from "../types";

const NUMERIC_TYPES = new Set(["integer", "bigint", "decimal", "float", "numeric"]);
const DATE_TYPES = new Set(["date", "datetime", "timestamp"]);
const SYSTEM_COLUMNS = new Set(["id", "timestamp", "row_version"]);

function isScalarPkValue(value: unknown): value is string | number | boolean {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    );
}

export function getTableEditDisabledReason(
    table: DataViewerTable | undefined,
): string | null {
    if (!table) {
        return "No hay tabla activa.";
    }

    if (table.can_update === false) {
        return "Sin permiso de edicion para esta tabla.";
    }

    return null;
}

export function isTableEditable(table: DataViewerTable | undefined): boolean {
    return getTableEditDisabledReason(table) === null;
}

export function getEditableColumns(
    table: DataViewerTable | undefined,
): DataViewerColumn[] {
    if (!table) {
        return [];
    }

    const explicitEditable = table.columns.filter((column) => column.editable === true);
    if (explicitEditable.length > 0) {
        return explicitEditable;
    }

    const pkColumns = new Set(table.pk_columns ?? []);
    return table.columns.filter(
        (column) => !SYSTEM_COLUMNS.has(column.name) && !pkColumns.has(column.name),
    );
}

export function getQueryColumnKeys(
    table: DataViewerTable | undefined,
    visibleColumns: string[],
): string[] {
    if (!table) {
        return visibleColumns;
    }

    if (table.can_update !== true) {
        return visibleColumns;
    }

    const editableColumns = getEditableColumns(table).map((column) => column.name);
    const pkColumns = table.pk_columns ?? [];
    const allColumns = [...visibleColumns, ...editableColumns, ...pkColumns];

    return [...new Set(allColumns)];
}

export function extractRowPk(
    row: DataViewerRow,
    pkColumns: string[] | null | undefined,
): DataViewerPk | null {
    if (Array.isArray(pkColumns) && pkColumns.length > 0) {
        const pk: DataViewerPk = {};

        for (const columnName of pkColumns) {
            const value = row[columnName];
            if (!isScalarPkValue(value)) {
                return null;
            }
            pk[columnName] = value;
        }

        return pk;
    }

    const fallbackColumns = ["id", "uuid", "code"];
    for (const columnName of fallbackColumns) {
        const value = row[columnName];
        if (!isScalarPkValue(value)) {
            continue;
        }
        return { [columnName]: value };
    }

    return null;
}

export function canEditRow(
    table: DataViewerTable | undefined,
    row: DataViewerRow,
): { allowed: boolean; reason?: string; pk?: DataViewerPk } {
    const tableReason = getTableEditDisabledReason(table);
    if (tableReason) {
        return { allowed: false, reason: tableReason };
    }

    const pk = extractRowPk(row, table?.pk_columns);
    if (!pk) {
        return {
            allowed: false,
            reason: "La fila no contiene un identificador usable (id/uuid/code o PK).",
        };
    }

    return { allowed: true, pk };
}

export function getInitialDraftValues(
    row: DataViewerRow,
    editableColumns: DataViewerColumn[],
): Record<string, unknown> {
    return editableColumns.reduce<Record<string, unknown>>((draft, column) => {
        const currentValue = row[column.name];
        draft[column.name] = currentValue ?? "";
        return draft;
    }, {});
}

export function normalizeDraftValue(
    rawValue: unknown,
    column: DataViewerColumn,
): unknown {
    if (typeof rawValue === "boolean") {
        return rawValue;
    }

    if (rawValue === null || rawValue === undefined) {
        return column.nullable ? null : "";
    }

    const asString = String(rawValue);
    if (asString.trim() === "") {
        return column.nullable ? null : "";
    }

    if (NUMERIC_TYPES.has(column.type)) {
        const maybeNumber = Number(asString);
        if (!Number.isNaN(maybeNumber)) {
            return maybeNumber;
        }
    }

    if (column.type === "boolean") {
        if (asString.toLowerCase() === "true") {
            return true;
        }
        if (asString.toLowerCase() === "false") {
            return false;
        }
    }

    if (DATE_TYPES.has(column.type)) {
        return asString;
    }

    return asString;
}

export function buildRowChanges(args: {
    row: DataViewerRow;
    editableColumns: DataViewerColumn[];
    draftValues: Record<string, unknown>;
}): DataViewerChanges {
    const changes: DataViewerChanges = {};

    for (const column of args.editableColumns) {
        const nextValue = normalizeDraftValue(args.draftValues[column.name], column);
        const previousValue = args.row[column.name] ?? null;

        if (!Object.is(nextValue, previousValue)) {
            changes[column.name] = nextValue;
        }
    }

    return changes;
}

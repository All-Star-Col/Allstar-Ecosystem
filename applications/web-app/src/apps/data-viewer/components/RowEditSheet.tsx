import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/sheet";
import { humanizeColumnName } from "../data/columnUtils";
import { getInitialDraftValues } from "../data/editing";
import type { DataViewerColumn, DataViewerRow } from "../types";

interface SaveErrorState {
    code?: string;
    detail: string;
    requestId?: string;
}

interface RowEditSheetProps {
    open: boolean;
    row: DataViewerRow | null;
    editableColumns: DataViewerColumn[];
    tableLabel: string;
    isSaving: boolean;
    saveError: SaveErrorState | null;
    disabledReason?: string | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (draftValues: Record<string, unknown>) => void;
    onRetry: () => void;
}

function isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || String(value).trim() === "";
}

function validateDraftValues(
    draftValues: Record<string, unknown>,
    editableColumns: DataViewerColumn[],
): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const column of editableColumns) {
        const value = draftValues[column.name];

        if (column.required && isEmptyValue(value)) {
            errors[column.name] = "Este campo es obligatorio.";
            continue;
        }

        if (
            typeof value === "string" &&
            typeof column.max_length === "number" &&
            column.max_length > 0 &&
            value.length > column.max_length
        ) {
            errors[column.name] = `Maximo ${column.max_length} caracteres.`;
        }
    }

    return errors;
}

function getInputValue(value: unknown): string | number {
    if (typeof value === "number") {
        return value;
    }

    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}

function renderColumnBadge(column: DataViewerColumn): string {
    return column.type.toUpperCase();
}

export function RowEditSheet({
    open,
    row,
    editableColumns,
    tableLabel,
    isSaving,
    saveError,
    disabledReason,
    onOpenChange,
    onSubmit,
    onRetry,
}: RowEditSheetProps) {
    const formId = "data-viewer-row-edit-form";
    const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open || !row) {
            return;
        }

        setDraftValues(getInitialDraftValues(row, editableColumns));
        setValidationErrors({});
    }, [editableColumns, open, row]);

    const hasEditableColumns = editableColumns.length > 0;
    const canSubmit = !isSaving && hasEditableColumns && !disabledReason;

    const rowIdentity = useMemo(() => {
        if (!row) {
            return "";
        }

        const fragments = Object.entries(row)
            .filter(([key]) => key === "id" || key.endsWith("_id"))
            .slice(0, 3)
            .map(([key, value]) => `${key}=${String(value)}`);

        return fragments.join(" · ");
    }, [row]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextErrors = validateDraftValues(draftValues, editableColumns);
        setValidationErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        onSubmit(draftValues);
    };

    const closeSheet = () => {
        if (!isSaving) {
            onOpenChange(false);
        }
    };

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                if (!isSaving) {
                    onOpenChange(nextOpen);
                }
            }}
        >
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl p-0 gap-0 flex flex-col overflow-hidden"
            >
                <SheetHeader className="border-b border-gray-200 px-6 py-4">
                    <SheetTitle>Editar fila</SheetTitle>
                    <SheetDescription>
                        {tableLabel}
                        {rowIdentity ? ` · ${rowIdentity}` : ""}
                    </SheetDescription>
                </SheetHeader>

                <form
                    id={formId}
                    className="flex-1 overflow-auto p-6 space-y-5"
                    onSubmit={handleSubmit}
                >
                    {disabledReason && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            {disabledReason}
                        </div>
                    )}

                    {!disabledReason && !hasEditableColumns && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            Esta tabla no tiene columnas editables configuradas.
                        </div>
                    )}

                    {!disabledReason &&
                        hasEditableColumns &&
                        editableColumns.map((column) => {
                            const fieldError = validationErrors[column.name];
                            const value = draftValues[column.name];
                            const isBoolean = column.type === "boolean";
                            const isTextArea = column.type === "text";
                            const isNumber = ["integer", "bigint", "decimal", "float", "numeric"].includes(
                                column.type,
                            );
                            const isDate = column.type === "date";
                            const isDateTime = column.type === "datetime" || column.type === "timestamp";
                            const hasEnum = Array.isArray(column.enum_values) && column.enum_values.length > 0;

                            return (
                                <div key={column.name} className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <label
                                            htmlFor={`field-${column.name}`}
                                            className="text-sm font-medium text-gray-900"
                                        >
                                            {humanizeColumnName(column.name)}
                                            {column.required ? " *" : ""}
                                        </label>
                                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                                            {renderColumnBadge(column)}
                                        </span>
                                    </div>

                                    {isBoolean ? (
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                id={`field-${column.name}`}
                                                type="checkbox"
                                                checked={Boolean(value)}
                                                onChange={(event) =>
                                                    setDraftValues((previous) => ({
                                                        ...previous,
                                                        [column.name]: event.target.checked,
                                                    }))
                                                }
                                            />
                                            {Boolean(value) ? "Si" : "No"}
                                        </label>
                                    ) : hasEnum ? (
                                        <select
                                            id={`field-${column.name}`}
                                            value={getInputValue(value)}
                                            onChange={(event) =>
                                                setDraftValues((previous) => ({
                                                    ...previous,
                                                    [column.name]: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                                        >
                                            {!column.required && <option value="">(sin valor)</option>}
                                            {column.enum_values?.map((enumValue) => (
                                                <option key={enumValue} value={enumValue}>
                                                    {enumValue}
                                                </option>
                                            ))}
                                        </select>
                                    ) : isTextArea ? (
                                        <textarea
                                            id={`field-${column.name}`}
                                            value={getInputValue(value)}
                                            onChange={(event) =>
                                                setDraftValues((previous) => ({
                                                    ...previous,
                                                    [column.name]: event.target.value,
                                                }))
                                            }
                                            rows={4}
                                            maxLength={column.max_length ?? undefined}
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                                        />
                                    ) : (
                                        <input
                                            id={`field-${column.name}`}
                                            type={
                                                isDate
                                                    ? "date"
                                                    : isDateTime
                                                      ? "datetime-local"
                                                      : isNumber
                                                        ? "number"
                                                        : "text"
                                            }
                                            step={isNumber && (column.type === "integer" || column.type === "bigint") ? "1" : undefined}
                                            value={getInputValue(value)}
                                            onChange={(event) =>
                                                setDraftValues((previous) => ({
                                                    ...previous,
                                                    [column.name]: event.target.value,
                                                }))
                                            }
                                            maxLength={column.max_length ?? undefined}
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                                        />
                                    )}

                                    {fieldError && (
                                        <p className="text-xs text-red-600">{fieldError}</p>
                                    )}
                                </div>
                            );
                        })}

                    {saveError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-1">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                    <p>{saveError.detail}</p>
                                    {saveError.requestId && (
                                        <p className="text-xs text-red-700">
                                            request_id: {saveError.requestId}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onRetry}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reintentar
                            </button>
                        </div>
                    )}
                </form>

                <SheetFooter className="border-t border-gray-200 px-6 py-4 flex-row justify-end">
                    <button
                        type="button"
                        onClick={closeSheet}
                        disabled={isSaving}
                        className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        form={formId}
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 rounded-md bg-[#122337] px-4 py-2 text-sm text-white hover:bg-[#1a3351] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? "Guardando..." : "Guardar cambios"}
                    </button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

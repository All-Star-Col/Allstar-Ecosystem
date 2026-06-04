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
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
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

function normalizeIdentifier(value: string | undefined | null): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^"+|"+$/g, "")
        .toLowerCase()
        .trim();
}

function isProductsTable(tableLabel: string): boolean {
    const normalized = normalizeIdentifier(tableLabel);
    return normalized === "producto" || normalized === "productos";
}

function formatCurrentLocalTimestamp(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 19);
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

        // Reset the edit draft whenever a different row opens in the sheet.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraftValues(getInitialDraftValues(row, editableColumns));
        setValidationErrors({});
    }, [editableColumns, open, row]);

    const hasEditableColumns = editableColumns.length > 0;
    const canSubmit = !isSaving && hasEditableColumns && !disabledReason;
    const productModificationDateColumnName = useMemo(
        () =>
            editableColumns.find(
                (column) =>
                    normalizeIdentifier(column.name) === "fecha_modificacion",
            )?.name,
        [editableColumns],
    );
    const shouldAutoUpdateProductModificationDate = useMemo(
        () =>
            isProductsTable(tableLabel) &&
            editableColumns.some(
                (column) => normalizeIdentifier(column.name) === "precio",
            ) &&
            productModificationDateColumnName !== undefined,
        [editableColumns, productModificationDateColumnName, tableLabel],
    );
    const visibleEditableColumns = useMemo(
        () =>
            editableColumns.filter(
                (column) =>
                    !(
                        isProductsTable(tableLabel) &&
                        normalizeIdentifier(column.name) === "fecha_modificacion"
                    ),
            ),
        [editableColumns, tableLabel],
    );

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

    const handleDraftValueChange = (columnName: string, value: unknown) => {
        setDraftValues((previous) => {
            const nextValues = {
                ...previous,
                [columnName]: value,
            };

            if (
                shouldAutoUpdateProductModificationDate &&
                normalizeIdentifier(columnName) === "precio" &&
                productModificationDateColumnName
            ) {
                nextValues[productModificationDateColumnName] =
                    formatCurrentLocalTimestamp();
            }

            return nextValues;
        });
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
                <SheetHeader className="border-b border-border px-6 py-4">
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
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                            {disabledReason}
                        </div>
                    )}

                    {!disabledReason && !hasEditableColumns && (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                            Esta tabla no tiene columnas editables configuradas.
                        </div>
                    )}

                    {!disabledReason &&
                        hasEditableColumns &&
                        visibleEditableColumns.map((column) => {
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
                            const checkedValue = value === true || value === "true";

                            return (
                                <div key={column.name} className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <label
                                            htmlFor={`field-${column.name}`}
                                            className="text-sm font-medium text-foreground"
                                        >
                                            {humanizeColumnName(column.name)}
                                            {column.required ? " *" : ""}
                                        </label>
                                        <Badge variant="secondary">
                                            {renderColumnBadge(column)}
                                        </Badge>
                                    </div>

                                    {isBoolean ? (
                                        <label className="inline-flex items-center gap-2 text-sm text-foreground">
                                            <Checkbox
                                                id={`field-${column.name}`}
                                                checked={checkedValue}
                                                onCheckedChange={(checked) =>
                                                    handleDraftValueChange(
                                                        column.name,
                                                        checked,
                                                    )
                                                }
                                            />
                                            {checkedValue ? "Si" : "No"}
                                        </label>
                                    ) : hasEnum ? (
                                        <Select
                                            value={getInputValue(value) as string}
                                            onValueChange={(selectedValue) =>
                                                handleDraftValueChange(
                                                    column.name,
                                                    selectedValue,
                                                )
                                            }
                                        >
                                            <SelectTrigger id={`field-${column.name}`}>
                                                <SelectValue placeholder="(sin valor)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!column.required && (
                                                    <SelectItem value="">
                                                        (sin valor)
                                                    </SelectItem>
                                                )}
                                                {column.enum_values?.map((enumValue) => (
                                                    <SelectItem key={enumValue} value={enumValue}>
                                                        {enumValue}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : isTextArea ? (
                                        <Textarea
                                            id={`field-${column.name}`}
                                            value={getInputValue(value) as string}
                                            onChange={(event) =>
                                                handleDraftValueChange(
                                                    column.name,
                                                    event.target.value,
                                                )
                                            }
                                            rows={4}
                                            maxLength={column.max_length ?? undefined}
                                        />
                                    ) : (
                                        <Input
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
                                                handleDraftValueChange(
                                                    column.name,
                                                    event.target.value,
                                                )
                                            }
                                            maxLength={column.max_length ?? undefined}
                                        />
                                    )}

                                    {fieldError && (
                                        <p className="text-xs text-destructive">{fieldError}</p>
                                    )}
                                </div>
                            );
                        })}

                    {saveError && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                    <p>{saveError.detail}</p>
                                    {saveError.requestId && (
                                        <p className="text-xs text-destructive/80">
                                            request_id: {saveError.requestId}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRetry}
                                disabled={isSaving}
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reintentar
                            </Button>
                        </div>
                    )}
                </form>

                <SheetFooter className="border-t border-border px-6 py-4 flex-row justify-end">
                    <Button
                        variant="outline"
                        onClick={closeSheet}
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>

                    <Button
                        variant="default"
                        type="submit"
                        form={formId}
                        disabled={!canSubmit}
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import { fetchProductComposerOptions } from "@/apps/forms/api";
import type { ProductComposerOptionAPI } from "@/apps/forms/api";
import { AsyncForeignKeyCombobox } from "@/apps/forms/components/DynamicFormField";
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

type ProductLookupPart = "base" | "modelo" | "referencia" | "tela";

const PRODUCT_EDIT_ORDER = [
    "id_base",
    "id_modelo",
    "id_referencia",
    "id_referencia_1",
    "id_referencia_2",
    "id_referencia_3",
    "id_tela",
    "precio",
];

const PRODUCT_FIELD_LABELS: Record<string, string> = {
    id_base: "Base",
    id_modelo: "Modelo",
    id_referencia: "Referencia 1",
    id_referencia_1: "Referencia 1",
    id_referencia_2: "Referencia 2",
    id_referencia_3: "Referencia 3",
    id_tela: "Tela",
    precio: "Precio",
};

function getProductLookupPart(columnName: string): ProductLookupPart | null {
    const normalized = normalizeIdentifier(columnName);
    if (normalized === "id_base") return "base";
    if (normalized === "id_modelo") return "modelo";
    if (
        normalized === "id_referencia" ||
        normalized === "id_referencia_1" ||
        normalized === "id_referencia_2" ||
        normalized === "id_referencia_3"
    ) {
        return "referencia";
    }
    if (normalized === "id_tela") return "tela";
    return null;
}

function productColumnSortIndex(column: DataViewerColumn): number {
    const normalized = normalizeIdentifier(column.name);
    const index = PRODUCT_EDIT_ORDER.indexOf(normalized);
    return index === -1 ? PRODUCT_EDIT_ORDER.length : index;
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
    const [productLabels, setProductLabels] = useState<Record<string, string>>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open || !row) {
            return;
        }

        // Reset the edit draft whenever a different row opens in the sheet.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraftValues(getInitialDraftValues(row, editableColumns));
        setProductLabels({});
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
        () => {
            const filtered = editableColumns.filter(
                (column) =>
                    !(
                        isProductsTable(tableLabel) &&
                        normalizeIdentifier(column.name) === "fecha_modificacion"
                    ),
            );
            if (!isProductsTable(tableLabel)) {
                return filtered;
            }
            return filtered
                .filter((column) =>
                    PRODUCT_EDIT_ORDER.includes(normalizeIdentifier(column.name)),
                )
                .sort(
                    (left, right) =>
                        productColumnSortIndex(left) - productColumnSortIndex(right),
                );
        },
        [editableColumns, tableLabel],
    );

    useEffect(() => {
        if (!open || !row || !isProductsTable(tableLabel)) {
            return;
        }

        let cancelled = false;
        const currentRow = row;

        async function loadInitialProductLabels() {
            const nextLabels: Record<string, string> = {};
            await Promise.all(
                visibleEditableColumns.map(async (column) => {
                    const part = getProductLookupPart(column.name);
                    const currentValue =
                        column.raw_value_column && column.raw_value_column in currentRow
                            ? currentRow[column.raw_value_column]
                            : currentRow[column.name];
                    if (!part || currentValue === null || currentValue === undefined || String(currentValue).trim() === "") {
                        return;
                    }

                    try {
                        const options = await fetchProductComposerOptions({
                            part,
                            query: String(currentValue),
                            limit: 10,
                        });
                        const match = options.find(
                            (option) => String(option.value) === String(currentValue),
                        );
                        if (match) {
                            nextLabels[column.name] = match.label;
                        }
                    } catch {
                        // The field can still be edited by searching manually.
                    }
                }),
            );

            if (!cancelled) {
                setProductLabels(nextLabels);
            }
        }

        void loadInitialProductLabels();

        return () => {
            cancelled = true;
        };
    }, [open, row, tableLabel, visibleEditableColumns]);

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

    const handleProductOptionSelect = (
        columnName: string,
        option: ProductComposerOptionAPI,
    ) => {
        setProductLabels((previous) => ({
            ...previous,
            [columnName]: option.label,
        }));
        handleDraftValueChange(columnName, option.value);
    };

    const clearProductLookup = (columnName: string) => {
        setProductLabels((previous) => {
            const next = { ...previous };
            delete next[columnName];
            return next;
        });
        handleDraftValueChange(columnName, "");
    };

    const productNamePreview = useMemo(() => {
        if (!isProductsTable(tableLabel)) {
            return "";
        }

        const referencia1Column =
            visibleEditableColumns.find(
                (column) => normalizeIdentifier(column.name) === "id_referencia_1",
            ) ??
            visibleEditableColumns.find(
                (column) => normalizeIdentifier(column.name) === "id_referencia",
            );
        const orderedColumns = [
            visibleEditableColumns.find(
                (column) => normalizeIdentifier(column.name) === "id_base",
            ),
            visibleEditableColumns.find(
                (column) => normalizeIdentifier(column.name) === "id_modelo",
            ),
            referencia1Column,
            visibleEditableColumns.find(
                (column) => normalizeIdentifier(column.name) === "id_referencia_2",
            ),
            visibleEditableColumns.find(
                (column) => normalizeIdentifier(column.name) === "id_referencia_3",
            ),
            visibleEditableColumns.find(
                (column) => normalizeIdentifier(column.name) === "id_tela",
            ),
        ].filter(Boolean) as DataViewerColumn[];

        return orderedColumns
            .map((column) => {
                const value = draftValues[column.name];
                if (
                    value === null ||
                    value === undefined ||
                    String(value).trim() === ""
                ) {
                    return "";
                }
                return productLabels[column.name] || "";
            })
            .filter(Boolean)
            .join(" ");
    }, [draftValues, productLabels, tableLabel, visibleEditableColumns]);

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
                            const productLookupPart =
                                isProductsTable(tableLabel)
                                    ? getProductLookupPart(column.name)
                                    : null;
                            const productFieldLabel =
                                PRODUCT_FIELD_LABELS[normalizeIdentifier(column.name)] ??
                                humanizeColumnName(column.name);

                            return (
                                <div key={column.name} className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <label
                                            htmlFor={`field-${column.name}`}
                                            className="text-sm font-medium text-foreground"
                                        >
                                            {productFieldLabel}
                                            {column.required ? " *" : ""}
                                        </label>
                                        <Badge variant="secondary">
                                            {renderColumnBadge(column)}
                                        </Badge>
                                    </div>

                                    {productLookupPart ? (
                                        <div className="flex gap-2">
                                            <div className="min-w-0 flex-1">
                                                <AsyncForeignKeyCombobox
                                                    value={String(getInputValue(value))}
                                                    options={
                                                        value && productLabels[column.name]
                                                            ? [
                                                                  {
                                                                      value: String(value),
                                                                      label: productLabels[column.name],
                                                                  },
                                                              ]
                                                            : []
                                                    }
                                                    onChange={(selectedValue) =>
                                                        handleDraftValueChange(
                                                            column.name,
                                                            selectedValue,
                                                        )
                                                    }
                                                    onOptionSelect={(option) =>
                                                        handleProductOptionSelect(
                                                            column.name,
                                                            option as ProductComposerOptionAPI,
                                                        )
                                                    }
                                                    onLookup={(query, limit) =>
                                                        fetchProductComposerOptions({
                                                            part: productLookupPart,
                                                            query,
                                                            limit,
                                                        })
                                                    }
                                                    limit={20}
                                                    hasError={Boolean(fieldError)}
                                                    initialLabel={productLabels[column.name]}
                                                />
                                            </div>
                                            {!column.required && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        clearProductLookup(column.name)
                                                    }
                                                >
                                                    Limpiar
                                                </Button>
                                            )}
                                        </div>
                                    ) : isBoolean ? (
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

                    {!disabledReason &&
                        isProductsTable(tableLabel) &&
                        hasEditableColumns && (
                            <div className="rounded-md border border-border bg-muted/30 p-4">
                                <div className="text-xs font-medium text-muted-foreground">
                                    Asi quedara el nombre
                                </div>
                                <div className="mt-1 text-sm font-semibold text-foreground">
                                    {productNamePreview || "Selecciona componentes para ver el nombre."}
                                </div>
                            </div>
                        )}

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

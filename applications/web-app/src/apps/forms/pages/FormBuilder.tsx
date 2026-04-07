import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTables } from "../store";
import { fetchForeignKeyLookup, submitFormData } from "../api";
import type { SubmitFormAPI } from "../api";
import { DynamicFormField } from "../components/DynamicFormField";
import { ConfirmModal } from "../components/ConfirmModal";
import { buildSubmitData } from "./formBuilderSubmit";
import {
    filterForeignKeyOptions,
    FOREIGN_KEY_INLINE_OPTIONS_LIMIT,
    FOREIGN_KEY_REMOTE_DEFAULT_LIMIT,
} from "../foreignKey";
import type { ColumnSchema, TableSchema } from "../schema";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import NotFound from "@/shared/components/NotFound";
import { Skeleton } from "@/shared/ui/skeleton";

function isSystemManagedColumn(columnName: string): boolean {
    const normalizedName = columnName.toLowerCase();
    return normalizedName === "id" || normalizedName === "timestamp";
}

export default function FormBuilder() {
    const navigate = useNavigate();
    const { tableId } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tableDetails, setTableDetails] = useState<TableSchema | undefined>();
    const [tableLoadError, setTableLoadError] = useState<string | null>(null);

    const { getTableById, loadTableById } = useTables();
    const tableSummary = tableId ? getTableById(tableId) : undefined;
    const table = tableDetails ?? tableSummary;

    const visibleColumns = useMemo(() => {
        if (!table) return [];
        return table.columns.filter(
            (column) => !isSystemManagedColumn(column.name),
        );
    }, [table]);

    useEffect(() => {
        let cancelled = false;

        async function loadTableDetailsForForm() {
            if (!tableId || !tableSummary) {
                setTableDetails(undefined);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setTableLoadError(null);

                const resolvedTable = await loadTableById(tableId);
                if (cancelled) return;

                const nextTable = resolvedTable ?? tableSummary;
                setTableDetails(nextTable);

                const initialData: Record<string, any> = {};
                nextTable.columns
                    .filter((column) => !isSystemManagedColumn(column.name))
                    .forEach((column) => {
                        if (column.defaultValue !== undefined) {
                            initialData[column.name] = column.defaultValue;
                        }
                    });
                setFormData(initialData);
                setErrors({});
            } catch (error) {
                if (cancelled) return;
                setTableDetails(tableSummary);
                setTableLoadError(
                    error instanceof Error
                        ? error.message
                        : "No se pudo cargar el detalle de la tabla",
                );
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadTableDetailsForForm();

        return () => {
            cancelled = true;
        };
    }, [tableId, tableSummary, loadTableById]);

    const handleForeignKeyLookup = useCallback(
        async (
            column: ColumnSchema,
            query: string,
            limit = FOREIGN_KEY_REMOTE_DEFAULT_LIMIT,
        ) => {
            const localOptions = column.foreignKeyOptions ?? [];
            const isSmallLookup =
                localOptions.length > 0 &&
                localOptions.length <= FOREIGN_KEY_INLINE_OPTIONS_LIMIT;

            if (isSmallLookup) {
                return filterForeignKeyOptions(localOptions, query, limit);
            }

            if (!table) {
                return filterForeignKeyOptions(localOptions, query, limit);
            }

            try {
                return await fetchForeignKeyLookup({
                    tableName: table.name,
                    columnName: column.name,
                    query,
                    limit,
                });
            } catch (error) {
                if (localOptions.length > 0) {
                    return filterForeignKeyOptions(localOptions, query, limit);
                }
                throw error;
            }
        },
        [table],
    );

    const handleFieldChange = (fieldName: string, value: any) => {
        setFormData((prev) => ({ ...prev, [fieldName]: value }));

        if (errors[fieldName]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }
    };

    const validateForm = (): boolean => {
        if (!table) return false;

        const nextErrors: Record<string, string> = {};

        visibleColumns.forEach((column) => {
            const value = formData[column.name];
            const isRequired = column.required && !column.nullable;

            if (
                isRequired &&
                (value === undefined || value === null || value === "")
            ) {
                nextErrors[column.name] = "Este campo es obligatorio";
            }
        });

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (validateForm()) {
            setShowConfirmModal(true);
            return;
        }

        toast.error("Formulario incompleto", {
            description: "Por favor completa todos los campos obligatorios",
        });
    };

    const handleConfirm = async () => {
        if (!table) return;

        setShowConfirmModal(false);
        setIsSubmitting(true);

        try {
            const payload: SubmitFormAPI = {
                table_name: table.name,
                data: buildSubmitData(visibleColumns, formData),
            };

            const result = await submitFormData(payload);

            if (result.status === "success") {
                toast.success("Registro guardado", {
                    description:
                        "El registro ha sido creado exitosamente en " +
                        table.displayName +
                        ". ID: " +
                        result.correlation_id,
                });

                handleClearForm();
            }
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("Error al guardar", {
                description:
                    error instanceof Error
                        ? error.message
                        : "No se pudo guardar el registro",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClearForm = () => {
        if (!table) return;

        const clearedData: Record<string, any> = {};
        visibleColumns.forEach((column) => {
            if (column.defaultValue !== undefined) {
                clearedData[column.name] = column.defaultValue;
            }
        });

        setFormData(clearedData);
        setErrors({});
        toast.info("Formulario limpiado");
    };

    if (!tableSummary && !isLoading) {
        return <NotFound />;
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/80 bg-card/80 backdrop-blur">
                <div className="container mx-auto max-w-5xl px-4 py-5">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/app/forms")}
                            className="text-foreground hover:bg-muted/60"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Button>
                        <div className="h-8 w-px bg-border" aria-hidden />
                        <div>
                            <h1 className="text-2xl font-semibold leading-tight text-foreground">
                                {table.displayName}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Nuevo registro
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-5xl px-4 py-8">
                <Card className="border border-border/80 shadow-sm bg-card">
                    <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="text-xl font-semibold text-foreground">
                            Nuevo registro: {table.displayName}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {tableLoadError && (
                            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                {tableLoadError}
                            </p>
                        )}
                        {isLoading ? (
                            <div className="space-y-6">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {visibleColumns.map((column) => (
                                        <div
                                            key={column.name}
                                            className={
                                                column.type === "text"
                                                    ? "md:col-span-2"
                                                    : ""
                                            }
                                        >
                                            <DynamicFormField
                                                column={column}
                                                value={formData[column.name]}
                                                onChange={(value) =>
                                                    handleFieldChange(
                                                        column.name,
                                                        value,
                                                    )
                                                }
                                                onForeignKeyLookup={
                                                    handleForeignKeyLookup
                                                }
                                                error={errors[column.name]}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 pt-6 border-t">
                                    <Button
                                        type="submit"
                                        className="flex-1 sm:flex-none bg-accent hover:bg-accent/90 text-accent-foreground"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-2" />
                                        )}
                                        {isSubmitting
                                            ? "Guardando..."
                                            : "Guardar"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClearForm}
                                        className="flex-1 sm:flex-none"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Limpiar
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </main>

            <ConfirmModal
                open={showConfirmModal}
                onOpenChange={setShowConfirmModal}
                onConfirm={handleConfirm}
                tableName={table.displayName}
            />
        </div>
    );
}

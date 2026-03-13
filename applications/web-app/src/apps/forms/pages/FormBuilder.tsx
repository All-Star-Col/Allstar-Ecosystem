import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTables } from "../store";
import { DynamicFormField } from "../components/DynamicFormField";
import { ConfirmModal } from "../components/ConfirmModal";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitFormData } from "../api";
import type { SubmitFormAPI } from "../api";
import { getCategoryBreadcrumbLabel } from "./categoryLabel";
import NotFound from "@/shared/components/NotFound";

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

    // Get data from context
    const { getTableById, getCategoryById } = useTables();

    const table = tableId ? getTableById(tableId) : undefined;
    const category = table ? getCategoryById(table.category) : undefined;
    const editableColumns = useMemo(
        () =>
            table?.columns.filter(
                (column) => !isSystemManagedColumn(column.name),
            ) ?? [],
        [table],
    );

    useEffect(() => {
        // Simulate loading
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);

            // Initialize form with default values
            if (table) {
                const initialData: Record<string, any> = {};
                editableColumns.forEach((column) => {
                    if (column.defaultValue !== undefined) {
                        initialData[column.name] = column.defaultValue;
                    }
                });
                setFormData(initialData);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [tableId, table, editableColumns]);

    const handleFieldChange = (fieldName: string, value: any) => {
        setFormData((prev) => ({ ...prev, [fieldName]: value }));
        // Clear error when user starts typing
        if (errors[fieldName]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }
    };

    const validateForm = (): boolean => {
        if (!table) return false;

        const newErrors: Record<string, string> = {};

        editableColumns.forEach((column) => {
            const value = formData[column.name];
            const isRequired = column.required && !column.nullable;

            if (
                isRequired &&
                (value === undefined || value === null || value === "")
            ) {
                newErrors[column.name] = "Este campo es obligatorio";
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (validateForm()) {
            setShowConfirmModal(true);
        } else {
            toast.error("Formulario incompleto", {
                description: "Por favor completa todos los campos obligatorios",
            });
        }
    };

    const handleConfirm = async () => {
        if (!table) return;

        setShowConfirmModal(false);
        setIsSubmitting(true);

        try {
            // Format data for the API
            const payload: SubmitFormAPI = {
                table_name: table.name,
                data: Object.entries(formData)
                    .filter(([column]) => !isSystemManagedColumn(column))
                    .map(([column, value]) => ({
                        column,
                        value,
                    })),
            };

            const result = await submitFormData(payload);

            if (result.status === "success") {
                toast.success("¡Registro guardado!", {
                    description: `El registro ha sido creado exitosamente en ${table.displayName}. ID: ${result.correlation_id}`,
                });

                // Clear form after successful submission
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
        if (table) {
            const clearedData: Record<string, any> = {};
            editableColumns.forEach((column) => {
                if (column.defaultValue !== undefined) {
                    clearedData[column.name] = column.defaultValue;
                }
            });
            setFormData(clearedData);
            setErrors({});
            toast.info("Formulario limpiado");
        }
    };

    if (!table) {
        return (
            <NotFound/>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-primary text-primary-foreground shadow-md">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/app/forms")}
                            className="text-primary-foreground hover:bg-primary-foreground/10"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Button>
                    </div>
                    <Breadcrumb>
                        <BreadcrumbList className="text-primary-foreground/80">
                            <BreadcrumbItem>
                                <BreadcrumbLink
                                    onClick={() => navigate("/app/forms")}
                                    className="hover:text-primary-foreground cursor-pointer"
                                >
                                    Tablas
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-primary-foreground/60" />
                            <BreadcrumbItem>
                                <BreadcrumbLink className="text-primary-foreground/80">
                                    {getCategoryBreadcrumbLabel(category)}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-primary-foreground/60" />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="text-primary-foreground">
                                    {table.displayName}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>

            {/* Form */}
            <main className="container mx-auto px-4 py-8 max-w-5xl">
                <Card className="shadow-lg">
                    <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="text-2xl">
                            Nuevo registro: {table.displayName}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
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
                                    {editableColumns.map((column) => (
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

            {/* Confirm Modal */}
            <ConfirmModal
                open={showConfirmModal}
                onOpenChange={setShowConfirmModal}
                onConfirm={handleConfirm}
                tableName={table.displayName}
            />
        </div>
    );
}

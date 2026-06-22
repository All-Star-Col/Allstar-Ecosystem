import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";

import {
    fetchOrderProcessItems,
    fetchOrderProcessOptions,
    fetchOrderProcessPlan,
    submitOrderProcess,
} from "../api";
import type {
    OrderProcessLookupOptionAPI,
    OrderProcessPlanAPI,
    OrderProcessPlanProcessAPI,
} from "../api";
import { AsyncForeignKeyCombobox } from "./DynamicFormField";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

interface ProcessFormRow {
    process_id: number;
    process_name: string;
    empleado_id: string;
    fecha_inicio: string;
    fecha_finalizado: string;
    comentarios: string;
}

function toDateTimeLocal(value: string | null | undefined): string {
    if (!value) return "";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
        return text.slice(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return `${text}T00:00`;
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

function fromPlanProcess(process: OrderProcessPlanProcessAPI): ProcessFormRow {
    return {
        process_id: process.process_id,
        process_name: process.process_name,
        empleado_id:
            process.empleado_id === null || process.empleado_id === undefined
                ? ""
                : String(process.empleado_id),
        fecha_inicio: toDateTimeLocal(process.fecha_inicio),
        fecha_finalizado: toDateTimeLocal(process.fecha_finalizado),
        comentarios: process.comentarios ?? "",
    };
}

export function OrderProcessForm() {
    const [itemId, setItemId] = useState("");
    const [itemLabel, setItemLabel] = useState("");
    const [upToProcess, setUpToProcess] = useState("1");
    const [plan, setPlan] = useState<OrderProcessPlanAPI | null>(null);
    const [rows, setRows] = useState<ProcessFormRow[]>([]);
    const [processOptions, setProcessOptions] = useState<OrderProcessLookupOptionAPI[]>([]);
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fallbackProcessOptions = useMemo(
        () =>
            [1, 6, 2, 3, 4, 5].map((value) => ({
                value: String(value),
                label: `Proceso ${value}`,
            })),
        [],
    );
    const visibleProcessOptions =
        processOptions.length > 0 ? processOptions : fallbackProcessOptions;

    useEffect(() => {
        let cancelled = false;

        async function loadProcessOptions() {
            try {
                const items = await fetchOrderProcessOptions();
                if (!cancelled) {
                    setProcessOptions(items);
                }
            } catch {
                if (!cancelled) {
                    setProcessOptions([]);
                }
            }
        }

        void loadProcessOptions();

        return () => {
            cancelled = true;
        };
    }, []);

    const lookupItems = useCallback(async (query: string, limit: number) => {
        return fetchOrderProcessItems({ query, limit });
    }, []);

    async function loadPlan() {
        if (!itemId) {
            toast.error("Selecciona un item");
            return;
        }

        setLoadingPlan(true);
        try {
            const nextPlan = await fetchOrderProcessPlan({
                itemId,
                upToProcess: Number(upToProcess),
            });
            setPlan(nextPlan);
            setRows(nextPlan.processes.map(fromPlanProcess));

            if (nextPlan.processes.length === 0) {
                toast.info("Sin procesos pendientes", {
                    description:
                        "Todos los procesos hasta el seleccionado ya tienen fecha de finalizado.",
                });
            }
        } catch (error) {
            toast.error("No se pudo cargar", {
                description:
                    error instanceof Error
                        ? error.message
                        : "No se pudo preparar la orden en proceso",
            });
        } finally {
            setLoadingPlan(false);
        }
    }

    function updateRow(
        processId: number,
        field: keyof Omit<ProcessFormRow, "process_id" | "process_name">,
        value: string,
    ) {
        setRows((current) =>
            current.map((row) =>
                row.process_id === processId ? { ...row, [field]: value } : row,
            ),
        );
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        if (!itemId || rows.length === 0) {
            toast.error("No hay procesos para guardar");
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitOrderProcess({
                item_id: Number(itemId),
                processes: rows.map((row) => ({
                    process_id: row.process_id,
                    empleado_id: row.empleado_id || null,
                    fecha_inicio: row.fecha_inicio || null,
                    fecha_finalizado: row.fecha_finalizado || null,
                    comentarios: row.comentarios || null,
                })),
            });

            toast.success("Orden en proceso guardada", {
                description: `Creados: ${result.inserted}. Actualizados: ${result.updated}.`,
            });
            await loadPlan();
        } catch (error) {
            toast.error("No se pudo guardar", {
                description:
                    error instanceof Error
                        ? error.message
                        : "No se pudo guardar la orden en proceso",
            });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                <div className="space-y-2">
                    <Label>Item</Label>
                    <AsyncForeignKeyCombobox
                        value={itemId}
                        options={[]}
                        onChange={setItemId}
                        onOptionSelect={(option) => setItemLabel(option.label)}
                        onLookup={lookupItems}
                        limit={20}
                        hasError={false}
                        initialLabel={itemLabel}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Proceso actual</Label>
                    <Select value={upToProcess} onValueChange={setUpToProcess}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {visibleProcessOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button type="button" onClick={loadPlan} disabled={loadingPlan}>
                    {loadingPlan ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Search className="h-4 w-4" />
                    )}
                    Cargar procesos
                </Button>
            </div>

            {plan && (
                <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Item seleccionado:{" "}
                    <span className="font-medium text-foreground">
                        {plan.item.label}
                    </span>
                </div>
            )}

            {rows.length > 0 && (
                <div className="space-y-4">
                    {rows.map((row) => (
                        <section
                            key={row.process_id}
                            className="rounded-md border border-border/80 bg-card p-4"
                        >
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="text-base font-semibold text-foreground">
                                    {row.process_name}
                                </h3>
                                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                                    Proceso {row.process_id}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Fecha inicio</Label>
                                    <Input
                                        type="datetime-local"
                                        value={row.fecha_inicio}
                                        onChange={(event) =>
                                            updateRow(
                                                row.process_id,
                                                "fecha_inicio",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Fecha finalizado</Label>
                                    <Input
                                        type="datetime-local"
                                        value={row.fecha_finalizado}
                                        onChange={(event) =>
                                            updateRow(
                                                row.process_id,
                                                "fecha_finalizado",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Empleado</Label>
                                    <Select
                                        value={row.empleado_id}
                                        onValueChange={(value) =>
                                            updateRow(
                                                row.process_id,
                                                "empleado_id",
                                                value,
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar empleado" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {plan?.employees.map((employee) => (
                                                <SelectItem
                                                    key={employee.value}
                                                    value={employee.value}
                                                >
                                                    {employee.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label>Comentarios</Label>
                                    <Textarea
                                        value={row.comentarios}
                                        onChange={(event) =>
                                            updateRow(
                                                row.process_id,
                                                "comentarios",
                                                event.target.value,
                                            )
                                        }
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </section>
                    ))}

                    <div className="flex justify-end border-t border-border/80 pt-4">
                        <Button type="submit" disabled={submitting}>
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Guardar orden en proceso
                        </Button>
                    </div>
                </div>
            )}
        </form>
    );
}

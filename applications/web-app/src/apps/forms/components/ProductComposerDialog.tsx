import { useCallback, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import {
    composeProduct,
    fetchColumnValues,
    fetchProductComposerOptions,
} from "../api";
import type { ProductComposerOptionAPI } from "../api";
import { AsyncForeignKeyCombobox } from "./DynamicFormField";

import { Button } from "@/shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type ProductPart = "base" | "modelo" | "referencia";
type Mode = "existing" | "create";

interface PartState {
    mode: Mode;
    id: string;
    label: string;
    text: string;
}

interface FabricState {
    mode: Mode;
    id: string;
    label: string;
    nombre: string;
    referencia: string;
}

interface ProductComposerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProductCreated: (product: { id: number; label: string }) => void;
}

const emptyPart = (): PartState => ({
    mode: "existing",
    id: "",
    label: "",
    text: "",
});

const emptyFabric = (): FabricState => ({
    mode: "existing",
    id: "",
    label: "",
    nombre: "",
    referencia: "",
});

function parseNumericId(value: string): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function modeButtonClass(active: boolean) {
    return active ? "bg-primary text-primary-foreground" : "";
}

function ProductPartField({
    label,
    part,
    state,
    onChange,
}: {
    label: string;
    part: ProductPart;
    state: PartState;
    onChange: (state: PartState) => void;
}) {
    const lookup = useCallback(
        async (query: string, limit: number) => {
            return fetchProductComposerOptions({ part, query, limit });
        },
        [part],
    );

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={modeButtonClass(state.mode === "existing")}
                    onClick={() => onChange({ ...state, mode: "existing" })}
                >
                    Homologado
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={modeButtonClass(state.mode === "create")}
                    onClick={() => onChange({ ...state, mode: "create" })}
                >
                    Crear con texto
                </Button>
            </div>
            {state.mode === "existing" ? (
                <AsyncForeignKeyCombobox
                    value={state.id}
                    options={
                        state.id && state.label
                            ? [{ value: state.id, label: state.label }]
                            : []
                    }
                    onChange={(value) => onChange({ ...state, id: value })}
                    onOptionSelect={(option) =>
                        onChange({ ...state, id: option.value, label: option.label })
                    }
                    onLookup={lookup}
                    limit={20}
                    hasError={false}
                    initialLabel={state.label}
                />
            ) : (
                <Input
                    value={state.text}
                    onChange={(event) =>
                        onChange({ ...state, text: event.target.value })
                    }
                    placeholder={`Escribir ${label.toLowerCase()}`}
                />
            )}
        </div>
    );
}

function FabricTextField({
    label,
    column,
    value,
    onChange,
}: {
    label: string;
    column: "nombre" | "referencia";
    value: string;
    onChange: (value: string) => void;
}) {
    const lookup = useCallback(
        async (query: string, limit: number) => {
            return fetchColumnValues({
                tableName: "tela",
                columnName: column,
                query,
                limit,
            });
        },
        [column],
    );

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <AsyncForeignKeyCombobox
                value={value}
                options={value ? [{ value, label: value }] : []}
                onChange={onChange}
                onLookup={lookup}
                limit={20}
                hasError={false}
                initialLabel={value}
            />
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={`O escribir ${label.toLowerCase()}`}
            />
        </div>
    );
}

export function ProductComposerDialog({
    open,
    onOpenChange,
    onProductCreated,
}: ProductComposerDialogProps) {
    const [base, setBase] = useState<PartState>(emptyPart);
    const [modelo, setModelo] = useState<PartState>(emptyPart);
    const [referencia1, setReferencia1] = useState<PartState>(emptyPart);
    const [referencia2, setReferencia2] = useState<PartState>(emptyPart);
    const [referencia3, setReferencia3] = useState<PartState>(emptyPart);
    const [tela, setTela] = useState<FabricState>(emptyFabric);
    const [precio, setPrecio] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setBase(emptyPart());
        setModelo(emptyPart());
        setReferencia1(emptyPart());
        setReferencia2(emptyPart());
        setReferencia3(emptyPart());
        setTela(emptyFabric());
        setPrecio("");
        setError(null);
    };

    const fabricLookup = useCallback(async (query: string, limit: number) => {
        return fetchProductComposerOptions({ part: "tela", query, limit });
    }, []);

    const getPartPayload = (state: PartState, name: string) => {
        const id = state.mode === "existing" ? parseNumericId(state.id) : null;
        const text = state.mode === "create" ? state.text.trim() : "";
        if (!id && !text) {
            throw new Error(`Falta ${name}`);
        }
        return { id, text };
    };

    const getOptionalPartPayload = (state: PartState) => {
        const id = state.mode === "existing" ? parseNumericId(state.id) : null;
        const text = state.mode === "create" ? state.text.trim() : "";
        return { id, text };
    };

    const handleCreate = async () => {
        try {
            setSubmitting(true);
            setError(null);
            const resolvedBase = getPartPayload(base, "base");
            const resolvedModelo = getPartPayload(modelo, "modelo");
            const resolvedReferencia1 = getOptionalPartPayload(referencia1);
            const resolvedReferencia2 = getOptionalPartPayload(referencia2);
            const resolvedReferencia3 = getOptionalPartPayload(referencia3);
            const telaId = tela.mode === "existing" ? parseNumericId(tela.id) : null;
            const telaNombre = tela.mode === "create" ? tela.nombre.trim() : "";
            const telaReferencia =
                tela.mode === "create" ? tela.referencia.trim() : "";

            if (!telaId && !telaNombre && !telaReferencia) {
                throw new Error("Falta tela");
            }

            const created = await composeProduct({
                base_id: resolvedBase.id,
                base_nombre: resolvedBase.text,
                modelo_id: resolvedModelo.id,
                modelo_nombre: resolvedModelo.text,
                referencia_1_id: resolvedReferencia1.id,
                referencia_1_nombre: resolvedReferencia1.text,
                referencia_2_id: resolvedReferencia2.id,
                referencia_2_nombre: resolvedReferencia2.text,
                referencia_3_id: resolvedReferencia3.id,
                referencia_3_nombre: resolvedReferencia3.text,
                tela_id: telaId,
                tela_nombre: telaNombre,
                tela_referencia: telaReferencia,
                precio: precio.trim() ? Number(precio) : null,
            });

            onProductCreated({ id: created.id, label: created.label });
            reset();
            onOpenChange(false);
        } catch (createError) {
            setError(
                createError instanceof Error
                    ? createError.message
                    : "No se pudo crear el producto",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);
                if (!nextOpen) reset();
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Crear producto</DialogTitle>
                    <DialogDescription>
                        Selecciona valores existentes o crea los faltantes para generar el producto.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 md:grid-cols-2">
                    <ProductPartField
                        label="Base"
                        part="base"
                        state={base}
                        onChange={setBase}
                    />
                    <ProductPartField
                        label="Modelo"
                        part="modelo"
                        state={modelo}
                        onChange={setModelo}
                    />
                    <ProductPartField
                        label="Referencia 1"
                        part="referencia"
                        state={referencia1}
                        onChange={setReferencia1}
                    />
                    <ProductPartField
                        label="Referencia 2"
                        part="referencia"
                        state={referencia2}
                        onChange={setReferencia2}
                    />
                    <ProductPartField
                        label="Referencia 3"
                        part="referencia"
                        state={referencia3}
                        onChange={setReferencia3}
                    />
                    <div className="space-y-2">
                        <Label>Precio</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={precio}
                            onChange={(event) => setPrecio(event.target.value)}
                            placeholder="Opcional"
                        />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                        <Label>Tela</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={modeButtonClass(tela.mode === "existing")}
                                onClick={() => setTela({ ...tela, mode: "existing" })}
                            >
                                Homologada
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={modeButtonClass(tela.mode === "create")}
                                onClick={() => setTela({ ...tela, mode: "create" })}
                            >
                                Crear tela
                            </Button>
                        </div>

                        {tela.mode === "existing" ? (
                            <AsyncForeignKeyCombobox
                                value={tela.id}
                                options={
                                    tela.id && tela.label
                                        ? [{ value: tela.id, label: tela.label }]
                                        : []
                                }
                                onChange={(value) => setTela({ ...tela, id: value })}
                                onOptionSelect={(option: ProductComposerOptionAPI) =>
                                    setTela({
                                        ...tela,
                                        id: option.value,
                                        label: option.label,
                                        nombre: option.nombre ?? "",
                                        referencia: option.referencia ?? "",
                                    })
                                }
                                onLookup={fabricLookup}
                                limit={20}
                                hasError={false}
                                initialLabel={tela.label}
                            />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                <FabricTextField
                                    label="Nombre de tela"
                                    column="nombre"
                                    value={tela.nombre}
                                    onChange={(value) =>
                                        setTela({ ...tela, nombre: value })
                                    }
                                />
                                <FabricTextField
                                    label="Referencia de tela"
                                    column="referencia"
                                    value={tela.referencia}
                                    onChange={(value) =>
                                        setTela({ ...tela, referencia: value })
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleCreate} disabled={submitting}>
                        {submitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        Crear producto
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

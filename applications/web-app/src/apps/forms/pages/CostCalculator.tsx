import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertCircle,
    ArrowLeft,
    Calculator,
    CheckCircle2,
    Loader2,
    PackagePlus,
    Save,
} from "lucide-react";
import { toast } from "sonner";

import {
    applyCostCalculatorCalculatedCost,
    createCostCalculatorMaterial,
    fetchCostCalculatorBreakdown,
    fetchCostCalculatorMaterials,
    fetchCostCalculatorProduct,
    fetchCostCalculatorProducts,
    saveCostCalculatorBreakdown,
    updateCostCalculatorLaborCost,
    updateCostCalculatorManualCost,
} from "../costCalculatorApi";
import type {
    CostCalculatorBreakdown,
    CostCalculatorMaterialSummary,
    CostCalculatorProductDetail,
} from "../costCalculatorApi";
import { AsyncForeignKeyCombobox } from "../components/DynamicFormField";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/table";

type CalculatorMode = "manual" | "automatic" | null;

type MaterialLine = {
    materialId: string;
    materialLabel: string;
    cantidad: string;
};

const EMPTY_LINES: MaterialLine[] = Array.from({ length: 10 }, () => ({
    materialId: "",
    materialLabel: "",
    cantidad: "",
}));

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 2,
    }).format(toNumber(value));
}

function materialOption(material: CostCalculatorMaterialSummary) {
    return {
        value: String(material.id),
        label: `${material.nombre} - ${formatCurrency(material.costo)}`,
    };
}

export default function CostCalculator() {
    const navigate = useNavigate();
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedProductLabel, setSelectedProductLabel] = useState("");
    const [product, setProduct] = useState<CostCalculatorProductDetail | null>(null);
    const [mode, setMode] = useState<CalculatorMode>(null);
    const [manualCost, setManualCost] = useState("");
    const [laborCost, setLaborCost] = useState("");
    const [breakdown, setBreakdown] = useState<CostCalculatorBreakdown | null>(null);
    const [showBreakdownForm, setShowBreakdownForm] = useState(false);
    const [materialLines, setMaterialLines] = useState<MaterialLine[]>(EMPTY_LINES);
    const [fabricQuantity, setFabricQuantity] = useState("");
    const [breakdownLaborCost, setBreakdownLaborCost] = useState("");
    const [creatingMaterialFor, setCreatingMaterialFor] = useState<number | null>(null);
    const [newMaterialName, setNewMaterialName] = useState("");
    const [newMaterialCost, setNewMaterialCost] = useState("0");
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);
    const [saving, setSaving] = useState(false);

    const currentCostLabel = useMemo(
        () => formatCurrency(product?.costo),
        [product?.costo],
    );

    async function loadProduct(productId: string) {
        if (!productId) return;
        setLoadingProduct(true);
        setMode(null);
        setBreakdown(null);
        setShowBreakdownForm(false);
        try {
            const loadedProduct = await fetchCostCalculatorProduct(productId);
            setProduct(loadedProduct);
            setSelectedProductLabel(loadedProduct.nombre);
            setManualCost(String(loadedProduct.costo ?? ""));
        } catch (error) {
            toast.error("No se pudo cargar el producto", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setLoadingProduct(false);
        }
    }

    async function loadBreakdown(productId = selectedProductId) {
        if (!productId) return;
        setLoadingBreakdown(true);
        try {
            const loadedBreakdown = await fetchCostCalculatorBreakdown(productId);
            setBreakdown(loadedBreakdown);
            setLaborCost(String(loadedBreakdown.costo_mano_obra ?? ""));
            if (!loadedBreakdown.exists) {
                setShowBreakdownForm(false);
                return;
            }
            setShowBreakdownForm(false);
        } catch (error) {
            toast.error("No se pudo cargar el despiece", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setLoadingBreakdown(false);
        }
    }

    useEffect(() => {
        if (mode === "automatic" && selectedProductId) {
            void loadBreakdown(selectedProductId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, selectedProductId]);

    async function lookupProducts(query: string, limit: number) {
        const products = await fetchCostCalculatorProducts({ query, limit });
        return products.map((item) => ({
            value: String(item.id),
            label: `${item.nombre} - ${formatCurrency(item.costo)}`,
        }));
    }

    async function lookupMaterials(query: string, limit: number) {
        const materials = await fetchCostCalculatorMaterials({ query, limit });
        return materials.map(materialOption);
    }

    function updateMaterialLine(index: number, patch: Partial<MaterialLine>) {
        setMaterialLines((current) =>
            current.map((line, lineIndex) =>
                lineIndex === index ? { ...line, ...patch } : line,
            ),
        );
    }

    function resetBreakdownForm() {
        setMaterialLines(EMPTY_LINES.map((line) => ({ ...line })));
        setFabricQuantity("");
        setBreakdownLaborCost("");
        setCreatingMaterialFor(null);
        setNewMaterialName("");
        setNewMaterialCost("0");
    }

    async function handleManualUpdate() {
        if (!selectedProductId) return;
        const newCost = toNumber(manualCost);
        if (newCost < 0) {
            toast.error("El costo no puede ser negativo");
            return;
        }

        setSaving(true);
        try {
            const updatedProduct = await updateCostCalculatorManualCost({
                productId: selectedProductId,
                newCost,
            });
            setProduct(updatedProduct);
            setManualCost(String(updatedProduct.costo ?? ""));
            toast.success("Costo actualizado");
        } catch (error) {
            toast.error("No se pudo actualizar el costo", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleCreateMaterial(index: number) {
        const nombre = newMaterialName.trim();
        if (!nombre) {
            toast.error("Escribe el nombre del material");
            return;
        }

        setSaving(true);
        try {
            const material = await createCostCalculatorMaterial({
                nombre,
                costo: toNumber(newMaterialCost),
            });
            updateMaterialLine(index, {
                materialId: String(material.id),
                materialLabel: materialOption(material).label,
            });
            setCreatingMaterialFor(null);
            setNewMaterialName("");
            setNewMaterialCost("0");
            toast.success("Material creado");
        } catch (error) {
            toast.error("No se pudo crear el material", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveBreakdown() {
        if (!selectedProductId) return;
        const materials = materialLines
            .filter((line) => line.materialId && toNumber(line.cantidad) > 0)
            .map((line) => ({
                material_id: Number(line.materialId),
                cantidad: toNumber(line.cantidad),
            }));

        setSaving(true);
        try {
            const updatedBreakdown = await saveCostCalculatorBreakdown({
                productId: selectedProductId,
                payload: {
                    materials,
                    cantidad_tela: toNumber(fabricQuantity),
                    costo_mano_obra: toNumber(breakdownLaborCost),
                },
            });
            setBreakdown(updatedBreakdown);
            setLaborCost(String(updatedBreakdown.costo_mano_obra ?? ""));
            setShowBreakdownForm(false);
            resetBreakdownForm();
            toast.success("Despiece cargado");
        } catch (error) {
            toast.error("No se pudo guardar el despiece", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdateLaborCost() {
        if (!selectedProductId) return;
        setSaving(true);
        try {
            const updatedBreakdown = await updateCostCalculatorLaborCost({
                productId: selectedProductId,
                laborCost: toNumber(laborCost),
            });
            setBreakdown(updatedBreakdown);
            toast.success("Mano de obra actualizada");
        } catch (error) {
            toast.error("No se pudo actualizar la mano de obra", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleApplyCalculatedCost() {
        if (!selectedProductId) return;
        setSaving(true);
        try {
            const result = await applyCostCalculatorCalculatedCost(selectedProductId);
            setProduct(result.product);
            setManualCost(String(result.product.costo ?? ""));
            setBreakdown(result.breakdown);
            toast.success("Costo del producto actualizado");
        } catch (error) {
            toast.error("No se pudo aplicar el costo calculado", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/80 bg-card/80 backdrop-blur">
                <div className="container mx-auto max-w-6xl px-4 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate("/app/forms")}
                                className="text-foreground hover:bg-muted/60"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                            <div className="h-8 w-px bg-border" aria-hidden />
                            <div>
                                <h1 className="text-2xl font-semibold leading-tight text-foreground">
                                    Calculadora de costos
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-6xl px-4 py-8">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
                    <Card className="self-start">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calculator className="h-5 w-5" />
                                Producto
                            </CardTitle>
                            <CardDescription>
                                Selecciona el producto para revisar o actualizar su costo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label>Producto</Label>
                                <AsyncForeignKeyCombobox
                                    value={selectedProductId}
                                    options={
                                        selectedProductId
                                            ? [
                                                  {
                                                      value: selectedProductId,
                                                      label: selectedProductLabel || selectedProductId,
                                                  },
                                              ]
                                            : []
                                    }
                                    onChange={(value) => {
                                        setSelectedProductId(value);
                                        void loadProduct(value);
                                    }}
                                    onOptionSelect={(option) =>
                                        setSelectedProductLabel(option.label)
                                    }
                                    onLookup={lookupProducts}
                                    limit={50}
                                    hasError={false}
                                    initialLabel={selectedProductLabel}
                                />
                            </div>

                            {loadingProduct && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Cargando producto...
                                </div>
                            )}

                            {product && (
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <div className="text-sm text-muted-foreground">
                                        Costo actual
                                    </div>
                                    <div className="mt-1 text-2xl font-semibold">
                                        {currentCostLabel}
                                    </div>
                                    <div className="mt-3 text-sm text-muted-foreground">
                                        Tela: {product.tela_label || "Sin tela asociada"}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Costo tela: {formatCurrency(product.tela_costo)}
                                    </div>
                                </div>
                            )}

                            {product && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant={mode === "manual" ? "default" : "outline"}
                                        onClick={() => setMode("manual")}
                                    >
                                        Manual
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={mode === "automatic" ? "default" : "outline"}
                                        onClick={() => setMode("automatic")}
                                    >
                                        Automatico
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-5">
                        {!product && (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    Selecciona un producto para iniciar.
                                </CardContent>
                            </Card>
                        )}

                        {product && mode === "manual" && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Actualizar manual</CardTitle>
                                    <CardDescription>
                                        Escribe el nuevo costo y guarda el cambio en producto.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-lg border p-4">
                                            <div className="text-sm text-muted-foreground">
                                                Producto seleccionado
                                            </div>
                                            <div className="mt-1 font-medium">{product.nombre}</div>
                                        </div>
                                        <div className="rounded-lg border p-4">
                                            <div className="text-sm text-muted-foreground">
                                                Costo actual
                                            </div>
                                            <div className="mt-1 font-medium">
                                                {currentCostLabel}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="max-w-xs space-y-2">
                                        <Label>Nuevo costo</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={manualCost}
                                            onChange={(event) =>
                                                setManualCost(event.target.value)
                                            }
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleManualUpdate}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        Actualizar costo
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {product && mode === "automatic" && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Actualizar automatico</CardTitle>
                                    <CardDescription>
                                        Calcula el costo usando materiales, tela y mano de obra.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {loadingBreakdown && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Cargando despiece...
                                        </div>
                                    )}

                                    {breakdown && !breakdown.exists && !showBreakdownForm && (
                                        <Alert>
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>
                                                Este producto no tiene despiece registrado.
                                            </AlertTitle>
                                            <AlertDescription>
                                                <Button
                                                    type="button"
                                                    className="mt-2"
                                                    onClick={() => {
                                                        resetBreakdownForm();
                                                        setShowBreakdownForm(true);
                                                    }}
                                                >
                                                    <PackagePlus className="mr-2 h-4 w-4" />
                                                    Crear despiece
                                                </Button>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {showBreakdownForm && (
                                        <div className="space-y-4 rounded-lg border p-4">
                                            <div>
                                                <h3 className="font-semibold">
                                                    Crear despiece
                                                </h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Registra hasta 10 materiales con su cantidad.
                                                </p>
                                            </div>
                                            <div className="grid gap-3">
                                                {materialLines.map((line, index) => (
                                                    <div
                                                        key={index}
                                                        className="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-[1fr_160px_auto]"
                                                    >
                                                        <div className="space-y-2">
                                                            <Label>Material {index + 1}</Label>
                                                            <AsyncForeignKeyCombobox
                                                                value={line.materialId}
                                                                options={
                                                                    line.materialId
                                                                        ? [
                                                                              {
                                                                                  value: line.materialId,
                                                                                  label:
                                                                                      line.materialLabel ||
                                                                                      line.materialId,
                                                                              },
                                                                          ]
                                                                        : []
                                                                }
                                                                onChange={(value) =>
                                                                    updateMaterialLine(index, {
                                                                        materialId: value,
                                                                    })
                                                                }
                                                                onOptionSelect={(option) =>
                                                                    updateMaterialLine(index, {
                                                                        materialLabel: option.label,
                                                                    })
                                                                }
                                                                onLookup={lookupMaterials}
                                                                limit={50}
                                                                hasError={false}
                                                                initialLabel={line.materialLabel}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Cantidad</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.0001"
                                                                value={line.cantidad}
                                                                onChange={(event) =>
                                                                    updateMaterialLine(index, {
                                                                        cantidad: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setCreatingMaterialFor(index)
                                                                }
                                                            >
                                                                Crear material
                                                            </Button>
                                                        </div>

                                                        {creatingMaterialFor === index && (
                                                            <div className="grid gap-2 border-t pt-3 md:col-span-3 md:grid-cols-[1fr_160px_auto]">
                                                                <div className="space-y-2">
                                                                    <Label>Nombre material</Label>
                                                                    <Input
                                                                        value={newMaterialName}
                                                                        onChange={(event) =>
                                                                            setNewMaterialName(
                                                                                event.target.value,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Costo</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={newMaterialCost}
                                                                        onChange={(event) =>
                                                                            setNewMaterialCost(
                                                                                event.target.value,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="flex items-end gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleCreateMaterial(index)
                                                                        }
                                                                        disabled={saving}
                                                                    >
                                                                        Crear
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        onClick={() =>
                                                                            setCreatingMaterialFor(null)
                                                                        }
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Cantidad tela</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.0001"
                                                        value={fabricQuantity}
                                                        onChange={(event) =>
                                                            setFabricQuantity(event.target.value)
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Costo mano de obra</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={breakdownLaborCost}
                                                        onChange={(event) =>
                                                            setBreakdownLaborCost(event.target.value)
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                onClick={handleSaveBreakdown}
                                                disabled={saving}
                                            >
                                                {saving ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="mr-2 h-4 w-4" />
                                                )}
                                                Cargar despiece
                                            </Button>
                                        </div>
                                    )}

                                    {breakdown?.exists && (
                                        <div className="space-y-5">
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <div className="rounded-lg border p-4">
                                                    <div className="text-sm text-muted-foreground">
                                                        Costo producto
                                                    </div>
                                                    <div className="mt-1 font-semibold">
                                                        {currentCostLabel}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border p-4">
                                                    <div className="text-sm text-muted-foreground">
                                                        Costo calculado
                                                    </div>
                                                    <div className="mt-1 font-semibold">
                                                        {formatCurrency(
                                                            breakdown.costo_calculado,
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border p-4">
                                                    <div className="text-sm text-muted-foreground">
                                                        Mano de obra
                                                    </div>
                                                    <div className="mt-1 font-semibold">
                                                        {formatCurrency(
                                                            breakdown.costo_mano_obra,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Material</TableHead>
                                                            <TableHead>Cantidad</TableHead>
                                                            <TableHead>Costo unitario</TableHead>
                                                            <TableHead>Total</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {breakdown.materials.length === 0 && (
                                                            <TableRow>
                                                                <TableCell
                                                                    colSpan={4}
                                                                    className="text-center text-muted-foreground"
                                                                >
                                                                    Sin materiales registrados
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                        {breakdown.materials.map((item) => (
                                                            <TableRow key={item.position}>
                                                                <TableCell>
                                                                    <div className="font-medium">
                                                                        {item.material_nombre}
                                                                    </div>
                                                                    <Badge variant="outline">
                                                                        Material {item.position}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {String(item.cantidad)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {formatCurrency(
                                                                        item.costo_unitario,
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {formatCurrency(
                                                                        item.costo_total,
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <div className="rounded-lg border p-4">
                                                    <div className="text-sm text-muted-foreground">
                                                        Total materiales
                                                    </div>
                                                    <div className="mt-1 font-semibold">
                                                        {formatCurrency(
                                                            breakdown.costo_total_materiales,
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border p-4">
                                                    <div className="text-sm text-muted-foreground">
                                                        Tela
                                                    </div>
                                                    <div className="mt-1 font-semibold">
                                                        {String(breakdown.cantidad_tela)} x{" "}
                                                        {formatCurrency(
                                                            breakdown.tela_costo_unitario,
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Total:{" "}
                                                        {formatCurrency(
                                                            breakdown.tela_costo_total,
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border p-4">
                                                    <div className="text-sm text-muted-foreground">
                                                        Costo calculado
                                                    </div>
                                                    <div className="mt-1 font-semibold">
                                                        {formatCurrency(
                                                            breakdown.costo_calculado,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[220px_auto_auto]">
                                                <div className="space-y-2">
                                                    <Label>Actualizar mano de obra</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={laborCost}
                                                        onChange={(event) =>
                                                            setLaborCost(event.target.value)
                                                        }
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={handleUpdateLaborCost}
                                                        disabled={saving}
                                                    >
                                                        Actualizar mano de obra
                                                    </Button>
                                                </div>
                                                <div className="flex items-end">
                                                    <Button
                                                        type="button"
                                                        onClick={handleApplyCalculatedCost}
                                                        disabled={saving}
                                                    >
                                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                                        Actualizar costo del producto
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

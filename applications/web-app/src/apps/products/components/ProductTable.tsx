import { Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AIBadge } from "./AIBadge";
import type { ProductoOrden } from "../types";
import { Button } from "@/shared/ui/button";

const ROW_STAGGER_DELAY = 0.05;

interface ProductTableProps {
    products: ProductoOrden[];
    onRemove: (id: string) => void;
    onAdd?: () => void;
    showAddButton?: boolean;
}

export function ProductTable({
    products,
    onRemove,
    onAdd,
    showAddButton = false,
}: ProductTableProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
        }).format(value);
    };

    if (products.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full">
                    <thead>
                        <tr className="bg-primary text-primary-foreground">
                            <th className="px-4 py-3 text-left text-sm">SKU</th>
                            <th className="px-4 py-3 text-left text-sm">
                                Producto
                            </th>
                            <th className="px-4 py-3 text-left text-sm">
                                Modelo
                            </th>
                            <th className="px-4 py-3 text-left text-sm">
                                Tela
                            </th>
                            <th className="px-4 py-3 text-center text-sm">
                                Cantidad
                            </th>
                            <th className="px-4 py-3 text-right text-sm">
                                Costo Unit.
                            </th>
                            <th className="px-4 py-3 text-right text-sm">
                                Total
                            </th>
                            <th className="px-4 py-3 text-center text-sm w-16"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence>
                            {products.map((productoOrden, index) => (
                                <motion.tr
                                    key={productoOrden.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: index * ROW_STAGGER_DELAY }}
                                    className="border-t border-border hover:bg-background/50 transition-colors"
                                >
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            {productoOrden.producto.sku}
                                            {productoOrden.autocompletadoPorIA && (
                                                <AIBadge
                                                    autocompletado={true}
                                                    requiereRevision={
                                                        productoOrden.requiereRevision
                                                    }
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-secondary-foreground">
                                        {productoOrden.producto.nombre}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {productoOrden.producto.modelo}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {productoOrden.producto.tela}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center text-secondary-foreground">
                                        {productoOrden.cantidad}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-secondary-foreground">
                                        {formatCurrency(productoOrden.costo)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-secondary-foreground">
                                        {formatCurrency(
                                            productoOrden.costo *
                                                productoOrden.cantidad,
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() =>
                                                onRemove(productoOrden.id)
                                            }
                                            className="group"
                                            title="Eliminar producto"
                                        >
                                            <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                                        </Button>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-foreground bg-primary-foreground">
                            <td
                                colSpan={6}
                                className="px-4 py-3 text-sm text-foreground"
                            >
                                Total
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-foreground">
                                {formatCurrency(
                                    products.reduce(
                                        (sum, p) => sum + p.costo * p.cantidad,
                                        0,
                                    ),
                                )}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {showAddButton && onAdd && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAdd}
                >
                    <Plus className="w-4 h-4" />
                    Agregar otro producto
                </Button>
            )}
        </div>
    );
}

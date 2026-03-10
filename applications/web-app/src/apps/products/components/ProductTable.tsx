import { Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AIBadge } from "./AIBadge";
import type { ProductoOrden } from "../types";

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
            <div className="overflow-x-auto rounded-lg border border-[rgba(47,51,57,0.1)]">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#122337] text-[#F6F5F0]">
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
                                    transition={{ delay: index * 0.05 }}
                                    className="border-t border-[rgba(47,51,57,0.1)] hover:bg-[#F6F5F0]/50 transition-colors"
                                >
                                    <td className="px-4 py-3 text-sm text-[#5a5c61]">
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
                                    <td className="px-4 py-3 text-sm text-[#2F3339]">
                                        {productoOrden.producto.nombre}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#5a5c61]">
                                        {productoOrden.producto.modelo}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#5a5c61]">
                                        {productoOrden.producto.tela}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center text-[#2F3339]">
                                        {productoOrden.cantidad}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-[#2F3339]">
                                        {formatCurrency(productoOrden.costo)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-[#2F3339]">
                                        {formatCurrency(
                                            productoOrden.costo *
                                                productoOrden.cantidad,
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() =>
                                                onRemove(productoOrden.id)
                                            }
                                            className="p-1.5 hover:bg-[#d4183d]/10 rounded transition-colors group"
                                            title="Eliminar producto"
                                        >
                                            <Trash2 className="w-4 h-4 text-[#5a5c61] group-hover:text-[#d4183d] transition-colors" />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-[#122337] bg-[#F6F5F0]">
                            <td
                                colSpan={6}
                                className="px-4 py-3 text-sm text-[#122337]"
                            >
                                Total
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-[#122337]">
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
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 text-sm text-[#122337] hover:text-[#B69559] transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Agregar otro producto
                </button>
            )}
        </div>
    );
}

import { motion } from "motion/react";
import {
    CheckCircle2,
    Calendar,
    User,
    FileText,
    Package,
    DollarSign,
    Eye,
    Plus,
} from "lucide-react";

interface Product {
    nombre_all_star: string;
    referencia: string;
    cantidad: number;
    valor: number;
}

interface SuccessViewProps {
    ordenProduccion: string;
    fecha: string;
    cliente: string;
    ordenCompra: string;
    productos: Product[];
    onVerDetalle: () => void;
    onNuevoPedido: () => void;
}

export function SuccessView({
    ordenProduccion,
    fecha,
    cliente,
    ordenCompra,
    productos,
    onVerDetalle,
    onNuevoPedido,
}: SuccessViewProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
        }).format(value);
    };

    const total = productos.reduce((sum, p) => sum + p.valor * p.cantidad, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
        >
            {/* Success Header */}
            <div className="bg-white rounded-lg p-8 shadow-sm border border-[rgba(47,51,57,0.08)] text-center mb-6">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                        delay: 0.2,
                    }}
                >
                    <CheckCircle2 className="w-20 h-20 text-[#10b981] mx-auto mb-4" />
                </motion.div>

                <h2 className="text-2xl text-[#122337] mb-2">
                    Pedido Enviado Correctamente
                </h2>
                <p className="text-[#5a5c61] mb-6">
                    Tu pedido ha sido registrado en el sistema de producción
                </p>

                {/* Número de OP Destacado */}
                <div className="bg-[#122337] rounded-lg p-6 inline-block">
                    <p className="text-[#F6F5F0]/80 text-sm mb-1">
                        Orden de Producción
                    </p>
                    <p className="text-[#B69559] text-4xl tracking-wider">
                        {ordenProduccion}
                    </p>
                </div>
            </div>

            {/* Información del Pedido */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-[rgba(47,51,57,0.08)] mb-6">
                <h3 className="text-[#122337] mb-4 pb-3 border-b border-[rgba(47,51,57,0.1)]">
                    Información del Pedido
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#122337]/5 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-[#122337]" />
                        </div>
                        <div>
                            <p className="text-xs text-[#5a5c61]">
                                Fecha de Creación
                            </p>
                            <p className="text-sm text-[#2F3339]">
                                {new Date(fecha).toLocaleDateString("es-CO", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#122337]/5 rounded-lg flex items-center justify-center">
                            <User className="w-5 h-5 text-[#122337]" />
                        </div>
                        <div>
                            <p className="text-xs text-[#5a5c61]">Cliente</p>
                            <p className="text-sm text-[#2F3339]">{cliente}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#122337]/5 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#122337]" />
                        </div>
                        <div>
                            <p className="text-xs text-[#5a5c61]">
                                Orden de Compra
                            </p>
                            <p className="text-sm text-[#2F3339]">
                                {ordenCompra}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#10b981]/10 rounded-lg flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
                        </div>
                        <div>
                            <p className="text-xs text-[#5a5c61]">Estado</p>
                            <p className="text-sm text-[#10b981]">En proceso</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resumen de Productos */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-[rgba(47,51,57,0.08)] mb-6">
                <h3 className="text-[#122337] mb-4 pb-3 border-b border-[rgba(47,51,57,0.1)] flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Resumen de Productos
                </h3>

                <div className="space-y-3">
                    {productos.map((producto, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-3 border-b border-[rgba(47,51,57,0.05)] last:border-0"
                        >
                            <div className="flex-1">
                                <p className="text-sm text-[#2F3339]">
                                    {producto.nombre_all_star}
                                </p>
                                <p className="text-xs text-[#5a5c61]">
                                    Ref: {producto.referencia}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-[#2F3339]">
                                    {producto.cantidad} ×{" "}
                                    {formatCurrency(producto.valor)}
                                </p>
                                <p className="text-xs text-[#5a5c61]">
                                    {formatCurrency(
                                        producto.cantidad * producto.valor,
                                    )}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t-2 border-[#122337] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-[#122337]" />
                        <span className="text-[#122337]">Total</span>
                    </div>
                    <span className="text-xl text-[#122337]">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={onVerDetalle}
                    className="flex-1 px-6 py-3 border-2 border-[#122337] text-[#122337] rounded-lg hover:bg-[#122337] hover:text-[#F6F5F0] transition-colors flex items-center justify-center gap-2"
                >
                    <Eye className="w-5 h-5" />
                    Ver Detalle del Pedido
                </button>
                <button
                    onClick={onNuevoPedido}
                    className="flex-1 px-6 py-3 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Registrar Nuevo Pedido
                </button>
            </div>
        </motion.div>
    );
}

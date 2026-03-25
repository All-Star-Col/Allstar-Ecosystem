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
import { Button } from "@/shared/ui/button";

const CELEBRATORY_SPRING = {
    type: "spring" as const,
    stiffness: 200,
    damping: 15,
};

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
            <div className="bg-white rounded-lg p-8 shadow-sm border border-border text-center mb-6">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                        ...CELEBRATORY_SPRING,
                        delay: 0.2,
                    }}
                >
                    <CheckCircle2 className="w-20 h-20 text-success mx-auto mb-4" />
                </motion.div>

                <h2 className="text-2xl text-foreground mb-2">
                    Pedido Enviado Correctamente
                </h2>
                <p className="text-muted-foreground mb-6">
                    Tu pedido ha sido registrado en el sistema de producción
                </p>

                {/* Número de OP Destacado */}
                <div className="bg-primary rounded-lg p-6 inline-block">
                    <p className="text-primary-foreground/80 text-sm mb-1">
                        Orden de Producción
                    </p>
                    <p className="text-accent text-4xl tracking-wider">
                        {ordenProduccion}
                    </p>
                </div>
            </div>

            {/* Información del Pedido */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-border mb-6">
                <h3 className="text-foreground mb-4 pb-3 border-b border-border">
                    Información del Pedido
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Fecha de Creación
                            </p>
                            <p className="text-sm text-secondary-foreground">
                                {new Date(fecha).toLocaleDateString("es-CO", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center">
                            <User className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Cliente</p>
                            <p className="text-sm text-secondary-foreground">{cliente}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Orden de Compra
                            </p>
                            <p className="text-sm text-secondary-foreground">
                                {ordenCompra}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Estado</p>
                            <p className="text-sm text-success">En proceso</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resumen de Productos */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-border mb-6">
                <h3 className="text-foreground mb-4 pb-3 border-b border-border flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Resumen de Productos
                </h3>

                <div className="space-y-3">
                    {productos.map((producto, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-3 border-b border-border last:border-0"
                        >
                            <div className="flex-1">
                                <p className="text-sm text-secondary-foreground">
                                    {producto.nombre_all_star}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Ref: {producto.referencia}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-secondary-foreground">
                                    {producto.cantidad} ×{" "}
                                    {formatCurrency(producto.valor)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatCurrency(
                                        producto.cantidad * producto.valor,
                                    )}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t-2 border-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-foreground" />
                        <span className="text-foreground">Total</span>
                    </div>
                    <span className="text-xl text-foreground">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    variant="outline"
                    size="lg"
                    onClick={onVerDetalle}
                    className="flex-1"
                >
                    <Eye className="w-5 h-5" />
                    Ver Detalle del Pedido
                </Button>
                <Button
                    variant="default"
                    size="lg"
                    onClick={onNuevoPedido}
                    className="flex-1"
                >
                    <Plus className="w-5 h-5" />
                    Registrar Nuevo Pedido
                </Button>
            </div>
        </motion.div>
    );
}

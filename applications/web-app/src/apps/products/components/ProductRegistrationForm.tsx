import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, Send, X, Plus, CheckCircle2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { FormSection } from "./FormSection";
import { FormInput } from "./FormInput";
import { FormSelect } from "./FormSelect";
import { FormRadio } from "./FormRadio";
import { FormDatePicker } from "./FormDatePicker";
import { FileUpload } from "./FileUpload";
import { ProductTable } from "./ProductTable";
import { ConfirmationModal } from "./ConfirmationModal";
import { SuccessView } from "./SuccessView";
import { ErrorBanner } from "./ErrorBanner";
import { ProgressIndicator } from "./ProgressIndicator";
import { EmptyProductsState } from "./EmptyProductsState";
import type { ProductoOrden } from "../types";

// Mock data - En producción, esto vendría de tu API
const MARCAS = [
    { value: "OREKA", label: "OREKA" },
    { value: "TOGO", label: "TOGO" },
    { value: "NIHAO", label: "NIHAO" },
];

const PRODUCTOS_POR_MARCA: Record<string, any[]> = {
    OREKA: [
        {
            value: "ORK001",
            label: "Oreka Premium Black",
            referencia: "ORK-001",
            modelo: "Premium",
            tela: "Algodón Premium",
            color: "Negro",
            precio: 85000,
        },
        {
            value: "ORK002",
            label: "Oreka Classic Blue",
            referencia: "ORK-002",
            modelo: "Classic",
            tela: "Polyester",
            color: "Azul",
            precio: 72000,
        },
    ],
    TOGO: [
        {
            value: "TGO001",
            label: "Togo Sport Red",
            referencia: "TGO-001",
            modelo: "Sport",
            tela: "Dri-Fit",
            color: "Rojo",
            precio: 95000,
        },
        {
            value: "TGO002",
            label: "Togo Urban White",
            referencia: "TGO-002",
            modelo: "Urban",
            tela: "Algodón Peinado",
            color: "Blanco",
            precio: 68000,
        },
    ],
    NIHAO: [
        {
            value: "NHO001",
            label: "Nihao Elite Green",
            referencia: "NHO-001",
            modelo: "Elite",
            tela: "Microfibra",
            color: "Verde",
            precio: 110000,
        },
        {
            value: "NHO002",
            label: "Nihao Basic Gray",
            referencia: "NHO-002",
            modelo: "Basic",
            tela: "Algodón",
            color: "Gris",
            precio: 55000,
        },
    ],
};

const TELAS_OPTIONS = [
    { value: "algodon", label: "Algodón" },
    { value: "polyester", label: "Polyester" },
    { value: "algodon_premium", label: "Algodón Premium" },
    { value: "dri_fit", label: "Dri-Fit" },
    { value: "microfibra", label: "Microfibra" },
    { value: "algodon_peinado", label: "Algodón Peinado" },
];

interface FormData {
    fecha: string;
    orden_compra: string;
    remitente: string;
    cliente: string;
    documento: string;
    correo: string;
    telefono: string;
    tipo_producto: "nuevo" | "existente";
    marca?: string;
    producto_existente?: string;
}

interface Product extends ProductoOrden {
    nombre_all_star: string;
    referencia: string;
    valor: number;
}

interface NewProductForm {
    nombre: string;
    referencia: string;
    modelo: string;
    tela: string;
    valor: string;
    cantidad: string;
}

type SubmitStatus = "idle" | "loading" | "success" | "error";

const SECTION_TRANSITION_DURATION = 0.3;

export function ProductRegistrationForm() {
    const {
        register,
        watch,
        setValue,
        formState: { errors },
        reset,
    } = useForm<FormData>({
        defaultValues: {
            fecha: new Date().toISOString().split("T")[0],
            tipo_producto: "nuevo",
        },
    });

    const [products, setProducts] = useState<Product[]>([]);
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
    const [files, setFiles] = useState<File[]>([]);
    const [productosDisponibles, setProductosDisponibles] = useState<any[]>([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessView, setShowSuccessView] = useState(false);
    const [ordenProduccion, setOrdenProduccion] = useState("");
    const [showErrorBanner, setShowErrorBanner] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [currentStep, setCurrentStep] = useState(0);

    // New product form
    const [newProduct, setNewProduct] = useState<NewProductForm>({
        nombre: "",
        referencia: "",
        modelo: "",
        tela: "",
        valor: "",
        cantidad: "1",
    });

    const tipoProducto = watch("tipo_producto");
    const marcaSeleccionada = watch("marca");
    const productoSeleccionado = watch("producto_existente");
    const correo = watch("correo");
    const telefono = watch("telefono");
    const cliente = watch("cliente");
    const documento = watch("documento");
    const ordenCompra = watch("orden_compra");
    const fecha = watch("fecha");

    // Progress steps
    const steps = [
        {
            label: "Información General",
            completed: currentStep > 0,
            active: currentStep === 0,
        },
        {
            label: "Productos",
            completed: currentStep > 1,
            active: currentStep === 1,
        },
        {
            label: "Confirmación",
            completed: currentStep > 2,
            active: currentStep === 2,
        },
    ];

    // Cargar productos cuando cambia la marca
    useEffect(() => {
        if (marcaSeleccionada && tipoProducto === "existente") {
            // En producción: GET /productos?marca=${marcaSeleccionada}
            setProductosDisponibles(
                PRODUCTOS_POR_MARCA[marcaSeleccionada] || [],
            );
            setValue("producto_existente", "");
        }
    }, [marcaSeleccionada, tipoProducto, setValue]);

    // Update current step based on form completion
    useEffect(() => {
        if (cliente && ordenCompra && correo && documento && telefono) {
            setCurrentStep(1);
            if (products.length > 0) {
                setCurrentStep(2);
            }
        } else {
            setCurrentStep(0);
        }
    }, [cliente, ordenCompra, correo, documento, telefono, products]);

    const agregarProductoNuevo = () => {
        if (
            !newProduct.nombre ||
            !newProduct.referencia ||
            !newProduct.tela ||
            !newProduct.valor ||
            !newProduct.cantidad
        ) {
            toast.error("Por favor completa todos los campos del producto");
            return;
        }

        const cantidad = parseInt(newProduct.cantidad) || 0;
        if (cantidad <= 0) {
            toast.error("La cantidad debe ser mayor a 0");
            return;
        }

        const producto: Product = {
            id: Math.random().toString(36).substring(7),
            nombre_all_star: newProduct.nombre,
            referencia: newProduct.referencia,
            cantidad: cantidad,
            valor: parseFloat(newProduct.valor.replace(/[^0-9]/g, "")) || 0,
            costo: parseFloat(newProduct.valor.replace(/[^0-9]/g, "")) || 0,
            autocompletadoPorIA: false,
            requiereRevision: false,
            producto: {
                id: Math.random().toString(36).substring(7),
                sku: newProduct.referencia || "SIN-SKU",
                nombre: newProduct.nombre,
                modelo: newProduct.modelo || "-",
                tela: newProduct.tela,
                referencia: newProduct.referencia,
                precio: parseFloat(newProduct.valor.replace(/[^0-9]/g, "")) || 0,
            },
        };

        setProducts([...products, producto]);

        // Reset form
        setNewProduct({
            nombre: "",
            referencia: "",
            modelo: "",
            tela: "",
            valor: "",
            cantidad: "1",
        });

        toast.success("Producto agregado");
    };

    const agregarProductoExistente = () => {
        if (!productoSeleccionado) {
            toast.error("Por favor selecciona un producto");
            return;
        }

        const productoData = productosDisponibles.find(
            (p) => p.value === productoSeleccionado,
        );
        if (!productoData) return;

        const producto: Product = {
            id: Math.random().toString(36).substring(7),
            nombre_all_star: productoData.label,
            referencia: productoData.referencia,
            cantidad: 1,
            valor: productoData.precio,
            costo: productoData.precio,
            autocompletadoPorIA: false,
            requiereRevision: false,
            producto: {
                id: Math.random().toString(36).substring(7),
                sku: productoData.referencia || productoData.value || "SIN-SKU",
                nombre: productoData.label,
                modelo: productoData.modelo || "-",
                tela: productoData.tela || "-",
                referencia: productoData.referencia || "",
                precio: productoData.precio || 0,
            },
        };

        setProducts([...products, producto]);
        setValue("producto_existente", "");
        toast.success("Producto agregado");
    };

    const eliminarProducto = (id: string) => {
        setProducts(products.filter((p) => p.id !== id));
        toast.success("Producto eliminado");
    };

    const validateForm = (): boolean => {
        if (!ordenCompra) {
            toast.error("Orden de compra es obligatoria");
            return false;
        }
        if (!cliente) {
            toast.error("Cliente es obligatorio");
            return false;
        }
        if (!documento || !/^[0-9]+$/.test(documento)) {
            toast.error("Documento inválido");
            return false;
        }
        if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            toast.error("Correo electrónico inválido");
            return false;
        }
        if (!telefono || telefono.length < 10) {
            toast.error("Número de contacto inválido");
            return false;
        }
        if (products.length === 0) {
            toast.error("Debes agregar al menos un producto");
            return false;
        }
        return true;
    };

    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitStatus("loading");

        // Preparar datos para envío
        const formData = watch();
        const payload: Record<string, unknown> = {
            orden_compra: formData.orden_compra,
            fecha: formData.fecha,
            remitente: formData.remitente,
            cliente: formData.cliente,
            documento: formData.documento,
            telefono: formData.telefono,
            correo: formData.correo,
            tipo_producto: formData.tipo_producto,
            marca: formData.marca || "",
            productos: products,
            adjuntos: files.map((f) => f.name), // En producción: URLs o base64
        };

        try {
            // En producción: POST a tu webhook n8n
            // const response = await fetch('https://tu-webhook-n8n.com', {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //     'Authorization': 'Bearer YOUR_TOKEN'
            //   },
            //   body: JSON.stringify(payload)
            // });
            void payload;

            // Simulación de envío
            await new Promise((resolve) => setTimeout(resolve, 2500));

            // Simular respuesta del servidor con número de OP
            const opNumber = `OP-${Date.now().toString().slice(-6)}`;
            setOrdenProduccion(opNumber);

            setSubmitStatus("success");
            setShowConfirmModal(false);

            // Mostrar vista de éxito después de un breve delay
            setTimeout(() => {
                setShowSuccessView(true);
            }, 500);
        } catch (error) {
            console.error("Error:", error);
            setSubmitStatus("error");
            setShowConfirmModal(false);
            setErrorMessage(
                "No se pudo conectar con el servidor. Intenta nuevamente.",
            );
            setShowErrorBanner(true);

            // Auto-hide error banner after 5 seconds
            setTimeout(() => {
                setShowErrorBanner(false);
            }, 5000);
        }
    };

    const handleRetry = () => {
        setSubmitStatus("idle");
        setShowConfirmModal(true);
    };

    const handleNewOrder = () => {
        setShowSuccessView(false);
        setSubmitStatus("idle");
        setProducts([]);
        setFiles([]);
        setCurrentStep(0);
        reset({
            fecha: new Date().toISOString().split("T")[0],
            tipo_producto: "nuevo",
        });
        setNewProduct({
            nombre: "",
            referencia: "",
            modelo: "",
            tela: "",
            valor: "",
            cantidad: "1",
        });
    };

    const handleViewDetail = () => {
        toast.info("Redirigiendo a detalles del pedido...");
        // En producción: navegar a la página de detalles
    };

    const formatCurrency = (value: string) => {
        const numero = value.replace(/[^0-9]/g, "");
        if (!numero) return "";
        return new Intl.NumberFormat("es-CO").format(parseInt(numero));
    };

    // Show success view
    if (showSuccessView) {
        return (
            <SuccessView
                ordenProduccion={ordenProduccion}
                fecha={fecha}
                cliente={cliente}
                ordenCompra={ordenCompra}
                productos={products}
                onVerDetalle={handleViewDetail}
                onNuevoPedido={handleNewOrder}
            />
        );
    }

    return (
        <>
            {/* Error Banner */}
            <ErrorBanner
                message={errorMessage}
                isVisible={showErrorBanner}
                onClose={() => setShowErrorBanner(false)}
            />

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleConfirmSubmit}
                isLoading={submitStatus === "loading"}
            />

            {/* Loading Overlay */}
            <AnimatePresence>
                {submitStatus === "loading" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-primary/20 backdrop-blur-[2px] z-40 flex items-center justify-center"
                    >
                        <div className="bg-white rounded-lg p-6 shadow-2xl flex items-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                            <span className="text-secondary-foreground">
                                Enviando datos al servidor…
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <form
                onSubmit={handleSubmitClick}
                className="max-w-6xl mx-auto space-y-6"
            >
                {/* Header */}
                <div className="bg-primary text-primary-foreground rounded-lg p-6">
                    <h1 className="text-2xl mb-2">
                        Registro de Productos para Producción
                    </h1>
                    <p className="text-sm text-primary-foreground/80">
                        All Star Colombia - Sistema de Gestión de Producción
                    </p>
                </div>

                {/* Progress Indicator */}
                <ProgressIndicator steps={steps} />

                {/* Sección 1: Información General */}
                <FormSection
                    title="Información General"
                    description="Datos del pedido y cliente"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormDatePicker
                            label="Fecha"
                            value={watch("fecha")}
                            onChange={(value) => setValue("fecha", value)}
                            required
                        />

                        <FormInput
                            label="Orden de Compra"
                            required
                            {...register("orden_compra", { required: true })}
                            error={
                                errors.orden_compra ? "Campo obligatorio" : ""
                            }
                            valid={!!ordenCompra && !errors.orden_compra}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput
                            label="Remitente"
                            {...register("remitente")}
                            placeholder="Nombre del remitente"
                        />

                        <FormInput
                            label="Cliente"
                            required
                            {...register("cliente", { required: true })}
                            error={errors.cliente ? "Campo obligatorio" : ""}
                            valid={!!cliente && !errors.cliente}
                            placeholder="Nombre del cliente"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormInput
                            label="Documento"
                            type="text"
                            required
                            {...register("documento", {
                                required: true,
                                pattern: /^[0-9]+$/,
                            })}
                            error={
                                errors.documento
                                    ? "Documento inválido (solo números)"
                                    : ""
                            }
                            valid={!!documento && /^[0-9]+$/.test(documento)}
                            placeholder="Número de documento"
                        />

                        <FormInput
                            label="Correo Electrónico"
                            type="email"
                            required
                            {...register("correo", {
                                required: true,
                                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                            })}
                            error={errors.correo ? "Email inválido" : ""}
                            valid={
                                !!correo &&
                                !errors.correo &&
                                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
                            }
                            placeholder="correo@ejemplo.com"
                        />

                        <FormInput
                            label="Número de Contacto"
                            type="tel"
                            required
                            {...register("telefono", {
                                required: true,
                                minLength: 10,
                            })}
                            error={errors.telefono ? "Mínimo 10 dígitos" : ""}
                            valid={!!telefono && telefono.length >= 10}
                            placeholder="300 123 4567"
                        />
                    </div>
                </FormSection>

                {/* Sección 2: Tipo de Producto */}
                <FormSection
                    title="Tipo de Producto"
                    description="Selecciona si es un producto nuevo o existente en catálogo"
                >
                    <FormRadio
                        label="¿Producto nuevo?"
                        options={[
                            { value: "nuevo", label: "Sí - Producto Nuevo" },
                            {
                                value: "existente",
                                label: "No - Producto Existente",
                            },
                        ]}
                        value={tipoProducto}
                        onChange={(value) =>
                            setValue(
                                "tipo_producto",
                                value as "nuevo" | "existente",
                            )
                        }
                    />
                </FormSection>

                {/* Sección 3A: Producto Nuevo */}
                <AnimatePresence mode="wait">
                    {tipoProducto === "nuevo" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: SECTION_TRANSITION_DURATION }}
                        >
                            <FormSection
                                title="Nuevo Producto"
                                description="Ingresa los detalles del producto nuevo"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput
                                        label="Nombre del Producto"
                                        value={newProduct.nombre}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                nombre: e.target.value,
                                            })
                                        }
                                        placeholder="Ej: Camiseta Premium"
                                        required
                                    />

                                    <FormInput
                                        label="Referencia"
                                        value={newProduct.referencia}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                referencia: e.target.value,
                                            })
                                        }
                                        placeholder="Ej: REF-001"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormInput
                                        label="Modelo"
                                        value={newProduct.modelo}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                modelo: e.target.value,
                                            })
                                        }
                                        placeholder="Ej: Premium"
                                    />

                                    <FormSelect
                                        label="Tela"
                                        options={TELAS_OPTIONS}
                                        value={newProduct.tela}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                tela: e.target.value,
                                            })
                                        }
                                        required
                                    />

                                    <FormInput
                                        label="Cantidad"
                                        type="number"
                                        min="1"
                                        value={newProduct.cantidad}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                cantidad: e.target.value,
                                            })
                                        }
                                        required
                                        error={
                                            parseInt(newProduct.cantidad) <= 0
                                                ? "Debe ser mayor a 0"
                                                : ""
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput
                                        label="Valor Unitario"
                                        value={newProduct.valor}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                valor: formatCurrency(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                        placeholder="$ 0"
                                        required
                                    />

                                    <div className="flex items-end">
                                        <Button
                                            variant="accent"
                                            size="md"
                                            onClick={agregarProductoNuevo}
                                            className="w-full"
                                        >
                                            <Plus className="w-5 h-5" />
                                            Agregar Producto
                                        </Button>
                                    </div>
                                </div>
                            </FormSection>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Sección 3B: Producto Existente */}
                <AnimatePresence mode="wait">
                    {tipoProducto === "existente" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: SECTION_TRANSITION_DURATION }}
                        >
                            <FormSection
                                title="Producto Existente"
                                description="Selecciona de nuestro catálogo"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormSelect
                                        label="Marca / Cliente"
                                        required
                                        options={MARCAS}
                                        {...register("marca")}
                                    />

                                    <FormSelect
                                        label="Producto"
                                        required
                                        options={productosDisponibles.map(
                                            (p) => ({
                                                value: p.value,
                                                label: p.label,
                                            }),
                                        )}
                                        disabled={!marcaSeleccionada}
                                        {...register("producto_existente")}
                                        placeholder={
                                            marcaSeleccionada
                                                ? "Seleccionar producto..."
                                                : "Primero selecciona una marca"
                                        }
                                    />
                                </div>

                                <Button
                                    variant="accent"
                                    size="md"
                                    onClick={agregarProductoExistente}
                                    disabled={!productoSeleccionado}
                                >
                                    <Plus className="w-5 h-5" />
                                    Agregar Producto
                                </Button>
                            </FormSection>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tabla de Productos o Estado Vacío */}
                {products.length > 0 ? (
                    <FormSection title="Productos Agregados">
                        <ProductTable
                            products={products}
                            onRemove={eliminarProducto}
                        />
                    </FormSection>
                ) : (
                    <EmptyProductsState />
                )}

                {/* Sección 4: Archivos Adjuntos */}
                <FormSection
                    title="Archivos Adjuntos"
                    description="Carga imágenes, PDFs o documentos relacionados"
                >
                    <FileUpload
                        label="Documentos"
                        onChange={setFiles}
                        maxSize={10}
                    />
                </FormSection>

                {/* Botones de Acción */}
                <div className="flex gap-4 justify-end sticky bottom-4 bg-background p-4 rounded-lg border border-border shadow-lg">
                    <Button
                        variant="outline"
                        size="md"
                        className="rounded-lg border-2"
                        disabled={submitStatus === "loading"}
                    >
                        <X className="w-5 h-5" />
                        Cancelar
                    </Button>

                    {submitStatus === "idle" && (
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            disabled={products.length === 0}
                            className="min-w-[220px] justify-center"
                        >
                            <Send className="w-5 h-5" />
                            Enviar a Producción
                        </Button>
                    )}

                    {submitStatus === "loading" && (
                        <Button
                            variant="primary"
                            size="lg"
                            loading
                            className="min-w-[220px] justify-center"
                        >
                            Enviando…
                        </Button>
                    )}

                    {submitStatus === "success" && (
                        <Button
                            variant="default"
                            size="lg"
                            disabled
                            className="min-w-[220px] justify-center bg-success text-white cursor-not-allowed"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            Pedido Enviado
                        </Button>
                    )}

                    {submitStatus === "error" && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={handleRetry}
                            className="min-w-[220px] justify-center text-destructive border-destructive hover:bg-destructive hover:text-white"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Reintentar
                        </Button>
                    )}
                </div>
            </form>
        </>
    );
}

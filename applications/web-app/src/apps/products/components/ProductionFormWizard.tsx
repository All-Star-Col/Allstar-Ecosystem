import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
    Loader2,
    Send,
    Plus,
    CheckCircle2,
    RefreshCw,
    ChevronRight,
    ChevronLeft,
    AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
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
import { EmptyProductsState } from "./EmptyProductsState";
import { AIProcessingState } from "./AIProcessingState";
import type {
    Cliente,
    ProductoOrden,
    FieldAIStatus,
    Email,
} from "../types";
import { MOCK_PRODUCTOS } from "../data/mockData";

interface FormData {
    fecha: string;
    oc_interno: string;
    oc_cliente: string;
    id_cliente: string;
    correo: string;
    telefono: string;
    tipo_producto: "nuevo" | "existente";
}

interface NewProductForm {
    producto_id: string;
    referencia: string;
    modelo: string;
    tela: string;
    cantidad: string;
    costo: string;
}

type SubmitStatus = "idle" | "loading" | "success" | "error";

interface ClienteApiResponse {
    codcliente?: number | string;
    cliente?: string;
    id?: string;
    nombre?: string;
    direccion?: string;
    correo?: string;
    email?: string;
    numero_contacto?: string;
    telefono?: string;
    ciudad?: string;
    [key: string]: unknown;
}

interface ClienteListItem {
    codcliente: number | string;
    cliente: string;
}

interface ClienteOption {
    label: string;
    value: string;
}

interface ProductoDbItem {
    codproducto: number | string;
    producto: string;
    equivalencia?: number | null;
}

interface ProductoOption {
    label: string;
    value: string;
}

const normalizeSpaces = (value: string) => value.replace(/\s+/g, " ").trim();

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ");

const normalizeForMatch = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

const extractOrdenCompraCliente = (subject: string, body?: string): string => {
    const source = `${subject || ""}\n${body || ""}`;

    // Caso 1: OP 56161 / OP-56161 / OP56161
    const opMatch = source.match(/\bOP[\s-]*([0-9]{3,})\b/i);
    if (opMatch?.[1]) {
        return opMatch[1];
    }

    // Caso 2: Orden de Compra 56161 / Orden de Compra Cliente: 56161
    const ordenCompraMatch = source.match(
        /\borden\s*de\s*compra(?:\s*cliente)?[\s:#-]*([0-9]{3,})\b/i,
    );
    if (ordenCompraMatch?.[1]) {
        return ordenCompraMatch[1];
    }

    return "";
};

const hasOPPattern = (subject: string): boolean =>
    /\bOP[\s-]*\d+\b/i.test(subject || "");

const extractOCInterno = (subject: string, body?: string): string => {
    const source = `${subject || ""}\n${body || ""}`;
    const primaryMatch = source.match(/\bOC[\s-]*\d{4}[\s-]*\d+\b/i);
    if (primaryMatch) {
        const normalized = normalizeSpaces(primaryMatch[0]).toUpperCase();
        const parts = normalized.match(/OC[\s-]*(\d{4})[\s-]*(\d+)/i);
        if (parts) {
            return `OC-${parts[1]}-${parts[2]}`;
        }
        return normalized.replace(/\s+/g, "");
    }

    const fallbackMatch = source.match(/\bOC[\s-]*\d+\b/i);
    if (!fallbackMatch) return "";

    const fallback = normalizeSpaces(fallbackMatch[0]).toUpperCase();
    return fallback.replace(/\s+/g, "");
};

const extractCantidadProducto = (subject: string, body?: string): string => {
    const source = `${subject || ""}\n${body || ""}`;
    const qtyMatch = source.match(/\b(?:cantidad|cant)\s*[:\-]?\s*(\d+)\b/i);
    if (qtyMatch?.[1]) {
        return qtyMatch[1];
    }
    return "1";
};

const findProductoFromEmail = (
    source: string,
    productos: ProductoDbItem[],
): ProductoDbItem | null => {
    const normalizedSource = normalizeForMatch(source);
    if (!normalizedSource) return null;

    let bestMatch: ProductoDbItem | null = null;
    let bestLength = 0;

    for (const producto of productos) {
        const nombre = String(producto.producto ?? "").trim();
        if (!nombre) continue;
        const normalizedName = normalizeForMatch(nombre);
        if (!normalizedName) continue;

        if (
            normalizedSource.includes(normalizedName) &&
            normalizedName.length > bestLength
        ) {
            bestMatch = producto;
            bestLength = normalizedName.length;
        }
    }

    return bestMatch;
};

const findClienteFromEmail = (
    source: string,
    clientesOptions: ClienteOption[],
): ClienteOption | null => {
    const normalizedSource = normalizeForMatch(source);
    if (!normalizedSource) return null;

    let bestMatch: ClienteOption | null = null;
    let bestLength = 0;

    for (const cliente of clientesOptions) {
        const nombre = String(cliente.label ?? "").trim();
        if (!nombre) continue;
        const normalizedName = normalizeForMatch(nombre);
        if (!normalizedName) continue;

        if (
            normalizedSource.includes(normalizedName) &&
            normalizedName.length > bestLength
        ) {
            bestMatch = cliente;
            bestLength = normalizedName.length;
        }
    }

    return bestMatch;
};

const normalizeClienteOption = (item: unknown): ClienteOption | null => {
    if (!item || typeof item !== "object") {
        return null;
    }

    const row = item as Record<string, unknown>;
    let codRaw = row.codcliente ?? row.id ?? row.value;
    let nameRaw = row.cliente ?? row.nombre ?? row.label;

    // Si el backend devolvio el cliente anidado como objeto, extraer sus campos.
    if (nameRaw && typeof nameRaw === "object") {
        const nested = nameRaw as Record<string, unknown>;
        codRaw = codRaw ?? nested.codcliente ?? nested.id ?? nested.value;
        nameRaw = nested.cliente ?? nested.nombre ?? nested.label;
    }

    // Algunos entornos serializan mal y entregan JSON en string.
    if (typeof nameRaw === "string" && nameRaw.trim().startsWith("{")) {
        try {
            const parsed = JSON.parse(nameRaw) as Record<string, unknown>;
            codRaw = codRaw ?? parsed.codcliente ?? parsed.id ?? parsed.value;
            nameRaw = parsed.cliente ?? parsed.nombre ?? parsed.label ?? "";
        } catch {
            // Ignorar parse error y continuar con el valor original.
        }
    }

    const label = typeof nameRaw === "string" ? nameRaw.trim() : "";
    if (!label || label === "{" || label === "}") {
        return null;
    }

    const value =
        codRaw === null || codRaw === undefined || String(codRaw).trim() === ""
            ? `name:${label}`
            : String(codRaw);

    return { label, value };
};

const normalizeProductoOption = (
    item: unknown,
): { option: ProductoOption; row: ProductoDbItem } | null => {
    if (!item || typeof item !== "object") {
        return null;
    }

    const row = item as Record<string, unknown>;
    const codRaw = row.codproducto ?? row.id ?? row.value;
    const nameRaw = row.producto ?? row.nombre ?? row.label;

    const label = typeof nameRaw === "string" ? nameRaw.trim() : "";
    if (!label || label === "{" || label === "}") {
        return null;
    }

    const value =
        codRaw === null || codRaw === undefined ? "" : String(codRaw).trim();
    if (!value) {
        return null;
    }

    return {
        option: { label, value },
        row: {
            codproducto: value,
            producto: label,
            equivalencia:
                typeof row.equivalencia === "number" ? row.equivalencia : null,
        },
    };
};

interface ProductionFormWizardProps {
    email?: Email;
    onSuccess?: (opNumber: string) => void;
    onCancel?: () => void;
}

export function ProductionFormWizard({
    email: incomingEmail,
    onSuccess,
    onCancel,
}: ProductionFormWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [activeEmail, setActiveEmail] = useState<Email | null>(
        incomingEmail || null,
    );
    const [aiProcessingStatus, setAiProcessingStatus] = useState<
        "processing" | "completed" | "error" | null
    >(null);
    const [products, setProducts] = useState<ProductoOrden[]>([]);
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
    const [files, setFiles] = useState<File[]>([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showReviewSubmitModal, setShowReviewSubmitModal] = useState(false);
    const [showSuccessView, setShowSuccessView] = useState(false);
    const [ordenProduccion, setOrdenProduccion] = useState("");
    const [showErrorBanner, setShowErrorBanner] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [fieldsAI, setFieldsAI] = useState<{ [key: string]: FieldAIStatus }>(
        {},
    );
    const [isLoadingCliente, setIsLoadingCliente] = useState(false);
    const [clienteInfoError, setClienteInfoError] = useState("");
    const [clienteSeleccionado, setClienteSeleccionado] =
        useState<Cliente | null>(null);
    const [clientes, setClientes] = useState<ClienteOption[]>([]);
    const [isLoadingClientes, setIsLoadingClientes] = useState(true);
    const [clientesError, setClientesError] = useState("");
    const [productosDb, setProductosDb] = useState<ProductoDbItem[]>([]);
    const [productosOptions, setProductosOptions] = useState<ProductoOption[]>(
        [],
    );
    const [isLoadingProductos, setIsLoadingProductos] = useState(true);
    const [productosError, setProductosError] = useState("");
    const [clienteAnterior, setClienteAnterior] = useState<string | null>(null);
    const [clientePendiente, setClientePendiente] = useState<string | null>(
        null,
    );
    const [showChangeClientModal, setShowChangeClientModal] = useState(false);
    const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
    const [emailPendiente, setEmailPendiente] = useState<Email | null>(null);
    const [showAIDecisionModal, setShowAIDecisionModal] =
        useState(!!incomingEmail);
    const [blockedEmailId, setBlockedEmailId] = useState<string | null>(null);

    const {
        register,
        watch,
        setValue,
        formState: { errors },
        reset,
    } = useForm<FormData>({
        defaultValues: {
            fecha: new Date().toISOString().split("T")[0],
            tipo_producto: "existente",
        },
    });

    const [newProduct, setNewProduct] = useState<NewProductForm>({
        producto_id: "",
        referencia: "",
        modelo: "",
        tela: "",
        cantidad: "1",
        costo: "",
    });

    const tipoProducto = watch("tipo_producto");
    const clienteId = watch("id_cliente");
    const ocInterno = watch("oc_interno");
    const ocCliente = watch("oc_cliente");
    const fecha = watch("fecha");
    const correo = watch("correo");
    const telefono = watch("telefono");
    const clienteField = register("id_cliente", { required: true });

    const hasFormChanges = () => {
        return (
            !!ocInterno ||
            !!ocCliente ||
            !!clienteId ||
            products.length > 0 ||
            files.length > 0
        );
    };

    const resetFormState = () => {
        setShowSuccessView(false);
        setSubmitStatus("idle");
        setProducts([]);
        setFiles([]);
        setCurrentStep(0);
        setFieldsAI({});
        setAiProcessingStatus(null);
        setIsLoadingCliente(false);
        setClienteInfoError("");
        setClienteSeleccionado(null);
        setClienteAnterior(null);
        setClientePendiente(null);
        setShowChangeClientModal(false);
        setShowConfirmModal(false);
        reset({
            fecha: new Date().toISOString().split("T")[0],
            tipo_producto: "existente",
        });
        setNewProduct({
            producto_id: "",
            referencia: "",
            modelo: "",
            tela: "",
            cantidad: "1",
            costo: "",
        });
    };

    const applyEmailSelection = (nuevoEmail: Email) => {
        resetFormState();
        setActiveEmail(nuevoEmail);
        setShowAIDecisionModal(true);
        setBlockedEmailId(null);
    };

    const handleEmailChange = (nuevoEmail: Email) => {
        if (hasFormChanges()) {
            setEmailPendiente(nuevoEmail);
            setShowChangeEmailModal(true);
        } else {
            applyEmailSelection(nuevoEmail);
        }
    };

    // Controla cambio de correo desde el dashboard sin perder datos.
    useEffect(() => {
        if (!incomingEmail) {
            return;
        }

        if (!activeEmail) {
            setActiveEmail(incomingEmail);
            setShowAIDecisionModal(true);
            setBlockedEmailId(null);
            return;
        }

        if (incomingEmail.id === activeEmail.id) {
            if (
                incomingEmail.subject !== activeEmail.subject ||
                incomingEmail.body !== activeEmail.body ||
                incomingEmail.preview !== activeEmail.preview
            ) {
                setActiveEmail(incomingEmail);
            }
            return;
        }

        if (blockedEmailId && blockedEmailId === incomingEmail.id) {
            return;
        }

        handleEmailChange(incomingEmail);
    }, [
        incomingEmail,
        activeEmail,
        blockedEmailId,
        ocInterno,
        ocCliente,
        clienteId,
        products,
        files,
    ]);

    // Simular procesamiento IA solo cuando el usuario lo confirma explÃ­citamente.
    useEffect(() => {
        if (activeEmail && aiProcessingStatus === "processing") {
            setTimeout(() => {
                processEmailWithAI();
            }, 3000);
        }
    }, [activeEmail, aiProcessingStatus]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchClientes = async () => {
            setIsLoadingClientes(true);
            setClientesError("");

            try {
                const response = await fetch("http://localhost:3000/api/clientes", {
                    method: "GET",
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error("Error cargando clientes:", {
                        endpoint: "/api/clientes",
                        status: response.status,
                        body: errorBody,
                    });
                    setClientesError(
                        `No se pudo cargar clientes (${response.status}).`,
                    );
                    throw new Error(
                        `Error consultando clientes: ${response.status}`,
                    );
                }

                const data = (await response.json()) as ClienteListItem[];

                const clientesOptions = Array.isArray(data)
                    ? data
                          .map((item) => normalizeClienteOption(item))
                          .filter((option): option is ClienteOption => !!option)
                    : [];

                setClientes(clientesOptions);
            } catch (error) {
                if ((error as DOMException).name === "AbortError") return;

                console.error("Excepcion cargando clientes:", error);
                setClientes([]);
                setClientesError(
                    (prev) => prev || "No se pudo cargar la lista de clientes.",
                );
            } finally {
                setIsLoadingClientes(false);
            }
        };

        fetchClientes();

        return () => {
            controller.abort();
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        const fetchProductos = async () => {
            setIsLoadingProductos(true);
            setProductosError("");

            try {
                const response = await fetch("/api/productos", {
                    method: "GET",
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error("Error cargando productos:", {
                        endpoint: "/api/productos",
                        status: response.status,
                        body: errorBody,
                    });
                    throw new Error(
                        `Error consultando productos: ${response.status}`,
                    );
                }

                const data = (await response.json()) as ProductoDbItem[];
                const normalized = Array.isArray(data)
                    ? data
                          .map((item) => normalizeProductoOption(item))
                          .filter(
                              (
                                  entry,
                              ): entry is {
                                  option: ProductoOption;
                                  row: ProductoDbItem;
                              } => !!entry,
                          )
                    : [];

                setProductosOptions(normalized.map((entry) => entry.option));
                setProductosDb(normalized.map((entry) => entry.row));
            } catch (error) {
                if ((error as DOMException).name === "AbortError") return;
                console.error("Excepcion cargando productos:", error);
                setProductosOptions([]);
                setProductosDb([]);
                setProductosError("No se pudo cargar la lista de productos.");
            } finally {
                setIsLoadingProductos(false);
            }
        };

        fetchProductos();

        return () => {
            controller.abort();
        };
    }, []);

    // Auto-llenar datos del cliente desde backend (GET /api/clientes/id/:codcliente)
    // - Si clienteId es numÃ©rico => /api/clientes/id/:id
    // - Si clienteId es "name:..." => /api/clientes/:name
    useEffect(() => {
        const controller = new AbortController();

        const FORM_EMAIL_FIELD: keyof FormData = "correo";
        const FORM_PHONE_FIELD: keyof FormData = "telefono";

        const clearClienteFields = (message = "") => {
            setValue(FORM_EMAIL_FIELD, "", {
                shouldDirty: true,
                shouldValidate: true,
            });
            setValue(FORM_PHONE_FIELD, "", {
                shouldDirty: true,
                shouldValidate: true,
            });
            setClienteSeleccionado(null);
            setClienteInfoError(message);
        };

        const fetchCliente = async () => {
            // Normaliza SIEMPRE a string
            const clienteCodigo = String(clienteId ?? "").trim();

            // Si no hay cliente seleccionado
            if (!clienteCodigo) {
                clearClienteFields("");
                setIsLoadingCliente(false);
                return;
            }

            setIsLoadingCliente(true);
            setClienteInfoError("");

            try {
                const isFallbackByName = clienteCodigo.startsWith("name:");
                const rawName = clienteCodigo.replace(/^name:/, "").trim();

                // Si no es fallback, puede venir como nÃºmero (codcliente)
                const isNumericId =
                    !isFallbackByName && /^\d+$/.test(clienteCodigo);

                // Decide endpoint robusto
                const endpoint = isFallbackByName
                    ? `/api/clientes/${encodeURIComponent(rawName)}`
                    : isNumericId
                      ? `/api/clientes/id/${encodeURIComponent(clienteCodigo)}`
                      : `/api/clientes/${encodeURIComponent(clienteCodigo)}`; // fallback por nombre

                const response = await fetch(endpoint, {
                    method: "GET",
                    signal: controller.signal,
                });

                if (response.status === 404) {
                    clearClienteFields("Cliente sin información registrada.");
                    return;
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error("Error cargando detalle cliente:", {
                        endpoint,
                        status: response.status,
                        body: errorBody,
                    });
                    throw new Error(
                        `Error consultando cliente: ${response.status}`,
                    );
                }

                const data = (await response.json()) as ClienteApiResponse;

                const correoCliente = String(
                    data.email ?? data.correo ?? "",
                ).trim();
                const telefonoCliente = String(
                    data.telefono ?? data.numero_contacto ?? "",
                ).trim();
                const ciudadCliente = String(data.ciudad ?? "").trim();
                const direccionCliente = String(data.direccion ?? "").trim();

                // Set fields (marcando dirty/validate para que tu UI se refresque)
                setValue(FORM_EMAIL_FIELD, correoCliente, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
                setValue(FORM_PHONE_FIELD, telefonoCliente, {
                    shouldDirty: true,
                    shouldValidate: true,
                });

                // Guardar objeto clienteSeleccionado para mostrar ciudad, etc.
                const idNormalizado = String(
                    data.codcliente ?? data.id ?? clienteCodigo,
                ).trim();
                const nombreNormalizado = String(
                    data.cliente ?? data.nombre ?? rawName ?? clienteCodigo,
                ).trim();

                setClienteSeleccionado({
                    id: idNormalizado,
                    nombre: nombreNormalizado,
                    email: correoCliente,
                    telefono: telefonoCliente,
                    ciudad: ciudadCliente || undefined,
                    direccion: direccionCliente || undefined,
                });

                // Mostrar mensaje SOLO si correo y telÃ©fono estÃ¡n vacÃ­os al mismo tiempo
                if (!correoCliente && !telefonoCliente) {
                    setClienteInfoError("Cliente sin información registrada.");
                } else {
                    setClienteInfoError("");
                }
            } catch (error) {
                if ((error as DOMException).name === "AbortError") return;
                clearClienteFields(
                    "No se pudo consultar la información del cliente.",
                );
            } finally {
                setIsLoadingCliente(false);
            }
        };

        fetchCliente();

        return () => controller.abort();
    }, [clienteId, setValue]);

    useEffect(() => {
        if (clienteId !== clienteAnterior) {
            setClienteAnterior(clienteId || null);
        }
    }, [clienteId, clienteAnterior]);

    useEffect(() => {
        if (!activeEmail) {
            return;
        }

        const subject = String(activeEmail.subject ?? "");
        const bodySource = stripHtml(
            String(activeEmail.body ?? activeEmail.preview ?? ""),
        );
        const opDetectada = extractOrdenCompraCliente(subject, bodySource);
        const ocInternoDetectada = extractOCInterno(subject, bodySource);
        const hasOpInSubject = hasOPPattern(subject);

        setValue("oc_cliente", opDetectada, {
            shouldDirty: true,
            shouldValidate: true,
        });
        setValue("oc_interno", ocInternoDetectada || "", {
            shouldDirty: true,
            shouldValidate: true,
        });

        setFieldsAI((prev) => ({
            ...prev,
            oc_cliente: {
                autocompletado: !!opDetectada,
                requiereRevision: hasOpInSubject ? !opDetectada : true,
                confianza: hasOpInSubject
                    ? opDetectada
                        ? "alta"
                        : "baja"
                    : "media",
            },
            oc_interno: {
                autocompletado: !!ocInternoDetectada,
                requiereRevision: false,
                confianza: ocInternoDetectada ? "alta" : "media",
            },
        }));
    }, [activeEmail, setValue]);

    const processEmailWithAI = () => {
        try {
            const subject = String(activeEmail?.subject ?? "");
            const bodySource = stripHtml(
                String(activeEmail?.body ?? activeEmail?.preview ?? ""),
            );
            const fromSource = String(
                activeEmail?.from ??
                    activeEmail?.fromName ??
                    activeEmail?.fromEmail ??
                    "",
            );
            const opDetectada = extractOrdenCompraCliente(subject, bodySource);
            const ocInternoDetectada = extractOCInterno(subject, bodySource);
            const hasOpInSubject = hasOPPattern(subject);
            const source = `${subject}\n${bodySource}\n${fromSource}`;
            const productoDetectado = findProductoFromEmail(
                source,
                productosDb,
            );
            const clienteDetectado = findClienteFromEmail(source, clientes);
            const cantidadDetectada = extractCantidadProducto(
                subject,
                bodySource,
            );

            setValue("oc_interno", ocInternoDetectada || "", {
                shouldDirty: true,
                shouldValidate: true,
            });
            setValue("oc_cliente", opDetectada, {
                shouldDirty: true,
                shouldValidate: true,
            });
            const clienteValue = clienteDetectado
                ? String(clienteDetectado.value)
                : "";
            setValue("id_cliente", clienteValue, {
                shouldDirty: true,
                shouldValidate: true,
            });
            setClienteAnterior(clienteValue || null);

            setNewProduct((prev) => ({
                ...prev,
                producto_id: productoDetectado
                    ? String(productoDetectado.codproducto)
                    : "",
                cantidad: cantidadDetectada,
            }));

            setFieldsAI({
                oc_interno: {
                    autocompletado: !!ocInternoDetectada,
                    requiereRevision: false,
                    confianza: ocInternoDetectada ? "alta" : "media",
                },
                oc_cliente: {
                    autocompletado: !!opDetectada,
                    requiereRevision: hasOpInSubject ? !opDetectada : true,
                    confianza: hasOpInSubject
                        ? opDetectada
                            ? "alta"
                            : "baja"
                        : "media",
                },
                producto_id: {
                    autocompletado: !!productoDetectado,
                    requiereRevision: !productoDetectado,
                    confianza: productoDetectado ? "alta" : "baja",
                },
                id_cliente: {
                    autocompletado: !!clienteDetectado,
                    requiereRevision: !clienteDetectado,
                    confianza: clienteDetectado ? "alta" : "baja",
                },
            });

            setAiProcessingStatus("completed");
            toast.success(
                productoDetectado
                    ? "Formulario completado. Producto detectado automaticamente."
                    : "Formulario completado. Selecciona manualmente el producto.",
            );
        } catch (error) {
            setAiProcessingStatus("error");
            setErrorMessage("No se pudo procesar el correo con IA");
        }
    };

    const handleRetryAI = () => {
        setAiProcessingStatus("processing");
        setTimeout(() => {
            processEmailWithAI();
        }, 2000);
    };

    const handleManualEdit = () => {
        setAiProcessingStatus("completed");
        toast.info("Modo de edicion manual activado");
    };

    const handleAIDecision = (mode: "ia" | "manual") => {
        setShowAIDecisionModal(false);
        if (mode === "ia") {
            setAiProcessingStatus("processing");
            return;
        }
        setAiProcessingStatus("completed");
        toast.info("Modo de edicion manual activado");
    };

    const handleClienteChange = (nuevoCliente: string) => {
        if (nuevoCliente === clienteId) {
            return;
        }

        if (products.length > 0) {
            setClientePendiente(nuevoCliente);
            setShowChangeClientModal(true);
            return;
        }

        setValue("id_cliente", nuevoCliente, {
            shouldValidate: true,
            shouldDirty: true,
        });
        setClienteAnterior(nuevoCliente);
    };

    const handleProductoSelectChange = (productoId: string) => {
        setNewProduct((prev) => ({
            ...prev,
            producto_id: productoId,
        }));

        setFieldsAI((prev) => ({
            ...prev,
            producto_id: {
                autocompletado: !!productoId,
                requiereRevision: !productoId,
                confianza: productoId ? "alta" : "baja",
            },
        }));
    };

    const confirmChangeCliente = () => {
        if (clientePendiente) {
            setProducts([]);
            setValue("id_cliente", clientePendiente, {
                shouldValidate: true,
                shouldDirty: true,
            });
            setClienteAnterior(clientePendiente);
        }

        setClientePendiente(null);
        setShowChangeClientModal(false);
    };

    const cancelChangeCliente = () => {
        setClientePendiente(null);
        setShowChangeClientModal(false);
    };

    const agregarProductoExistente = () => {
        if (
            !newProduct.producto_id ||
            !newProduct.cantidad ||
            !newProduct.costo
        ) {
            toast.error("Por favor completa todos los campos");
            return;
        }

        const cantidad = parseInt(newProduct.cantidad) || 0;
        if (cantidad <= 0) {
            toast.error("La cantidad debe ser mayor a 0");
            return;
        }

        const productoDb = productosDb.find(
            (p) => String(p.codproducto) === newProduct.producto_id,
        );
        if (!productoDb) {
            toast.error("Producto no encontrado en base de datos");
            return;
        }

        const productoOrden: ProductoOrden = {
            id: Math.random().toString(36).substring(7),
            producto: {
                id: String(productoDb.codproducto),
                sku: "",
                nombre: productoDb.producto,
                modelo: "",
                tela: "",
                referencia: "",
                precio: 0,
            },
            cantidad,
            costo: parseFloat(newProduct.costo.replace(/[^0-9]/g, "")) || 0,
            autocompletadoPorIA: false,
            requiereRevision: false,
        };

        setProducts([...products, productoOrden]);
        setNewProduct({
            producto_id: "",
            referencia: "",
            modelo: "",
            tela: "",
            cantidad: "1",
            costo: "",
        });
        toast.success("Producto agregado");
    };

    const agregarProductoNuevo = () => {
        if (
            !newProduct.producto_id ||
            !newProduct.referencia ||
            !newProduct.modelo ||
            !newProduct.tela ||
            !newProduct.cantidad ||
            !newProduct.costo
        ) {
            toast.error("Por favor completa todos los campos del producto");
            return;
        }

        const cantidad = parseInt(newProduct.cantidad) || 0;
        if (cantidad <= 0) {
            toast.error("La cantidad debe ser mayor a 0");
            return;
        }

        const productoBase = MOCK_PRODUCTOS.find(
            (p) => p.id === newProduct.producto_id,
        );
        if (!productoBase) return;

        const productoOrden: ProductoOrden = {
            id: Math.random().toString(36).substring(7),
            producto: {
                ...productoBase,
                referencia: newProduct.referencia,
                modelo: newProduct.modelo,
                tela: newProduct.tela,
            },
            cantidad,
            costo: parseFloat(newProduct.costo.replace(/[^0-9]/g, "")) || 0,
            autocompletadoPorIA: false,
            requiereRevision: false,
        };

        setProducts([...products, productoOrden]);
        setNewProduct({
            producto_id: "",
            referencia: "",
            modelo: "",
            tela: "",
            cantidad: "1",
            costo: "",
        });
        toast.success("Producto nuevo agregado");
    };

    const eliminarProducto = (id: string) => {
        setProducts(products.filter((p) => p.id !== id));
        toast.success("Producto eliminado");
    };

    const validateStep = (step: number): boolean => {
        if (step === 0) {
            if (isLoadingCliente) {
                toast.error("Espera a que termine la consulta del cliente");
                return false;
            }
            const subject = String(activeEmail?.subject ?? "");
            const emailHasOp = hasOPPattern(subject);

            if (!ocInterno || !clienteId) {
                toast.error("Completa todos los campos obligatorios");
                return false;
            }
            if (emailHasOp && !ocCliente) {
                toast.error(
                    "La orden de compra cliente es obligatoria para este correo",
                );
                return false;
            }
            if (ocCliente && !/^[0-9]+$/.test(ocCliente)) {
                toast.error("Orden de compra cliente debe ser solo números");
                return false;
            }
            return true;
        }
        if (step === 1) {
            if (products.length === 0) {
                toast.error("Debes agregar al menos un producto");
                return false;
            }
            const invalidProduct = products.some((item) => {
                const codproducto = String(item.producto?.id ?? "").trim();
                const cantidad = Number(item.cantidad) || 0;
                const costo = Number(item.costo);
                return (
                    !codproducto ||
                    cantidad <= 0 ||
                    Number.isNaN(costo) ||
                    costo < 0
                );
            });
            if (invalidProduct) {
                toast.error(
                    "Hay productos inválidos. Revisa producto, cantidad y costo.",
                );
                return false;
            }
            return true;
        }
        return true;
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => Math.min(prev + 1, 2));
        }
    };

    const prevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const submitCurrentForm = async (
        showSuccessAfterSubmit: boolean,
    ): Promise<boolean> => {
        const hasFieldsToReviewNow =
            Object.values(fieldsAI).some((f) => f.requiereRevision) ||
            products.some((p) => p.requiereRevision);

        if (hasFieldsToReviewNow) {
            toast.warning("Hay campos marcados para revision");
        }

        if (!validateStep(0) || !validateStep(1)) {
            return false;
        }

        setSubmitStatus("loading");

        const payloadReal = {
            email_id: String(activeEmail?.id ?? ""),
            email_subject: String(activeEmail?.subject ?? ""),
            email_from: String(
                activeEmail?.fromEmail ?? activeEmail?.from ?? "",
            ),
            receivedDateTime: String(activeEmail?.receivedDateTime ?? ""),
            fecha: fecha,
            oc_interno: ocInterno,
            oc_cliente: ocCliente,
            cliente_id: clienteId,
            productos: products.map((p) => ({
                codproducto: String(p.producto?.id ?? ""),
                producto: String(p.producto?.nombre ?? ""),
                color_tela: String(
                    p.producto?.tela ?? p.producto?.referencia ?? "",
                ),
                cantidad: Number(p.cantidad) || 0,
                costo_unitario: Number(p.costo) || 0,
            })),
            payload_ia: {
                fieldsAI,
                raw_email: activeEmail
                    ? {
                          id: activeEmail.id,
                          subject: activeEmail.subject,
                          from: activeEmail.from,
                          fromEmail: activeEmail.fromEmail,
                          preview: activeEmail.preview,
                          receivedDateTime: activeEmail.receivedDateTime,
                      }
                    : null,
            },
        };

        try {
            const createOrderResponse = await fetch("/api/ordenes/produccion", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payloadReal),
            });

            if (!createOrderResponse.ok) {
                const errorBody = await createOrderResponse.text();
                throw new Error(
                    errorBody ||
                        `Error creando orden (${createOrderResponse.status})`,
                );
            }

            const createOrderData = (await createOrderResponse.json()) as {
                opNumber?: string;
                message?: string;
            };
            const opNumber = String(createOrderData.opNumber ?? "").trim();
            if (!opNumber) {
                throw new Error("El backend no retornó opNumber.");
            }
            setOrdenProduccion(opNumber);

            if (activeEmail?.id) {
                const patchResponse = await fetch(
                    `/api/emails/${encodeURIComponent(activeEmail.id)}/status`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ status: "enviado" }),
                    },
                );

                if (!patchResponse.ok) {
                    const patchError = await patchResponse.text();
                    throw new Error(
                        patchError ||
                            `Error actualizando estado del correo (${patchResponse.status})`,
                    );
                }
            }

            setSubmitStatus("success");
            setShowConfirmModal(false);
            setShowReviewSubmitModal(false);

            if (showSuccessAfterSubmit) {
                setShowSuccessView(true);
                onSuccess?.(opNumber);
            } else {
                onSuccess?.(opNumber);
            }

            return true;
        } catch (error) {
            console.error("Error:", error);
            setSubmitStatus("error");
            setShowConfirmModal(false);
            setShowReviewSubmitModal(false);
            setErrorMessage(
                error instanceof Error && error.message
                    ? error.message
                    : "No se pudo conectar con el servidor. Intenta nuevamente.",
            );
            setShowErrorBanner(true);
            setTimeout(() => setShowErrorBanner(false), 5000);
            return false;
        }
    };

    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();

        // Verificar si hay campos que requieren revisar
        const hasFieldsToReview =
            Object.values(fieldsAI).some((f) => f.requiereRevision) ||
            products.some((p) => p.requiereRevision);

        if (!validateStep(0) || !validateStep(1)) {
            return;
        }

        if (hasFieldsToReview) {
            setShowReviewSubmitModal(true);
            return;
        }

        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = async () => {
        await submitCurrentForm(true);
    };

    const handleSubmitWithReview = () => {
        setShowReviewSubmitModal(false);
        setShowConfirmModal(true);
    };

    const cancelEmailChange = () => {
        if (incomingEmail?.id) {
            setBlockedEmailId(incomingEmail.id);
        }
        setEmailPendiente(null);
        setShowChangeEmailModal(false);
    };

    const discardAndContinueEmailChange = () => {
        if (emailPendiente) {
            applyEmailSelection(emailPendiente);
        }
        setEmailPendiente(null);
        setShowChangeEmailModal(false);
    };

    const saveAndContinueEmailChange = async () => {
        const wasSaved = await submitCurrentForm(false);
        if (!wasSaved) {
            return;
        }

        if (emailPendiente) {
            applyEmailSelection(emailPendiente);
        }
        setEmailPendiente(null);
        setShowChangeEmailModal(false);
        setSubmitStatus("idle");
    };

    const handleRetry = () => {
        setSubmitStatus("idle");
        setShowConfirmModal(true);
    };

    const handleNewOrder = () => {
        resetFormState();
        setShowAIDecisionModal(false);
    };

    const formatCurrency = (value: string) => {
        const numero = value.replace(/[^0-9]/g, "");
        if (!numero) return "";
        return new Intl.NumberFormat("es-CO").format(parseInt(numero));
    };

    const hasFieldsToReview =
        Object.values(fieldsAI).some((f) => f.requiereRevision) ||
        products.some((p) => p.requiereRevision);

    // Progress steps
    const steps = [
        { label: "Información General", number: 1 },
        { label: "Productos", number: 2 },
        { label: "Confirmación", number: 3 },
    ];

    // Success view
    if (showSuccessView) {
        const clienteNombre = clienteSeleccionado?.nombre || clienteId || "";
        return (
            <SuccessView
                ordenProduccion={ordenProduccion}
                fecha={fecha}
                cliente={clienteNombre}
                ordenCompra={ocInterno}
                productos={products.map((p) => ({
                    nombre_all_star: p.producto.nombre,
                    referencia: p.producto.referencia,
                    cantidad: p.cantidad,
                    valor: p.costo,
                }))}
                onVerDetalle={() => toast.info("Redirigiendo a detalles...")}
                onNuevoPedido={handleNewOrder}
            />
        );
    }

    // AI Processing
    if (aiProcessingStatus && aiProcessingStatus !== "completed") {
        return (
            <AIProcessingState
                status={aiProcessingStatus}
                errorMessage={errorMessage}
                onRetry={handleRetryAI}
                onManualEdit={handleManualEdit}
            />
        );
    }

    return (
        <>
            <ErrorBanner
                message={errorMessage}
                isVisible={showErrorBanner}
                onClose={() => setShowErrorBanner(false)}
            />

            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleConfirmSubmit}
                isLoading={submitStatus === "loading"}
            />

            <AnimatePresence>
                {showReviewSubmitModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#122337]/35 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white w-full max-w-lg rounded-lg shadow-2xl border border-[rgba(47,51,57,0.12)]"
                        >
                            <div className="p-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#C7664C]/10 flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="w-5 h-5 text-[#C7664C]" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg text-[#2F3339]">
                                            Campos por revisar
                                        </h3>
                                        <p className="text-sm text-[#5a5c61] mt-1">
                                            Hay campos con revisión pendiente.
                                            ¿Deseas enviar igual o volver a
                                            revisar?
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowReviewSubmitModal(false)
                                        }
                                        className="px-4 py-2.5 border border-[rgba(47,51,57,0.2)] text-[#2F3339] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                                    >
                                        Volver a revisar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmitWithReview}
                                        className="px-4 py-2.5 bg-[#122337] text-white rounded-lg hover:bg-[#1a3352] transition-colors"
                                    >
                                        Enviar igual
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showChangeEmailModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#122337]/35 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white w-full max-w-xl rounded-lg shadow-2xl border border-[rgba(47,51,57,0.12)]"
                        >
                            <div className="p-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#C7664C]/10 flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="w-5 h-5 text-[#C7664C]" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg text-[#2F3339]">
                                            Cambiar de correo
                                        </h3>
                                        <p className="text-sm text-[#5a5c61] mt-1">
                                            Tienes información sin guardar en
                                            este formulario.
                                            <br />
                                            ¿Deseas guardar el registro actual
                                            antes de abrir el nuevo correo?
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={cancelEmailChange}
                                        className="px-4 py-2.5 border border-[rgba(47,51,57,0.2)] text-[#2F3339] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={discardAndContinueEmailChange}
                                        className="px-4 py-2.5 bg-[#C7664C] text-white rounded-lg hover:bg-[#b85b44] transition-colors"
                                    >
                                        Descartar cambios
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveAndContinueEmailChange}
                                        className="px-4 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-colors"
                                    >
                                        Guardar y continuar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showAIDecisionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#122337]/35 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white w-full max-w-lg rounded-lg shadow-2xl border border-[rgba(47,51,57,0.12)]"
                        >
                            <div className="p-6">
                                <h3 className="text-lg text-[#2F3339]">
                                    Nuevo correo seleccionado
                                </h3>
                                <p className="text-sm text-[#5a5c61] mt-1">
                                    ¿Cómo deseas completar este formulario?
                                </p>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleAIDecision("manual")
                                        }
                                        className="px-4 py-2.5 border border-[rgba(47,51,57,0.2)] text-[#2F3339] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                                    >
                                        Llenar manualmente
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAIDecision("ia")}
                                        className="px-4 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-colors"
                                    >
                                        Completar con IA
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showChangeClientModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#122337]/35 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white w-full max-w-md rounded-lg shadow-2xl border border-[rgba(47,51,57,0.12)]"
                        >
                            <div className="p-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#C7664C]/10 flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="w-5 h-5 text-[#C7664C]" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg text-[#2F3339]">
                                            Confirmar cambio de cliente
                                        </h3>
                                        <p className="text-sm text-[#5a5c61] mt-1">
                                            {"Cambiar el cliente eliminar" +
                                                String.fromCharCode(225) +
                                                " los productos agregados actualmente. " +
                                                String.fromCharCode(191) +
                                                "Deseas continuar?"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={cancelChangeCliente}
                                        className="px-4 py-2.5 border border-[rgba(47,51,57,0.2)] text-[#2F3339] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmChangeCliente}
                                        className="px-4 py-2.5 bg-[#C7664C] text-white rounded-lg hover:bg-[#b85b44] transition-colors"
                                    >
                                        Confirmar y limpiar productos
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {submitStatus === "loading" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#122337]/20 backdrop-blur-[2px] z-40 flex items-center justify-center"
                    >
                        <div className="bg-white rounded-lg p-6 shadow-2xl flex items-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-[#122337]" />
                            <span className="text-[#2F3339]">
                                Enviando datos al servidor...
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <form onSubmit={handleSubmitClick} className="space-y-6">
                <div>
                    <button
                        type="button"
                        onClick={() => {
                            window.location.href = "/dashboard";
                        }}
                        className="inline-flex items-center gap-2 text-sm text-[#2F3339] hover:text-[#122337] transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Volver
                    </button>
                </div>

                {/* Header */}
                <div className="bg-[#122337] text-[#F6F5F0] rounded-lg p-6">
                    <h1 className="text-2xl mb-2">
                        Registro de Productos para Producción
                    </h1>
                    <p className="text-sm text-[#F6F5F0]/80">
                        All Star Colombia - Sistema de Gestión de Producción
                    </p>
                </div>

                {/* Progress Wizard */}
                <div className="bg-white rounded-lg p-4 shadow-sm border border-[rgba(47,51,57,0.08)]">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute top-5 left-0 right-0 h-0.5 bg-[rgba(47,51,57,0.1)] -z-10">
                            <motion.div
                                className="h-full bg-[#122337]"
                                initial={{ width: "0%" }}
                                animate={{
                                    width: `${(currentStep / 2) * 100}%`,
                                }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>

                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="flex flex-col items-center relative z-10 flex-1"
                            >
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{
                                        scale: currentStep >= index ? 1 : 0.9,
                                    }}
                                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                    ${
                        currentStep > index
                            ? "bg-[#122337] border-[#122337]"
                            : currentStep === index
                              ? "bg-white border-[#B69559]"
                              : "bg-white border-[rgba(47,51,57,0.2)]"
                    }
                  `}
                                >
                                    {currentStep > index ? (
                                        <CheckCircle2 className="w-5 h-5 text-[#F6F5F0]" />
                                    ) : (
                                        <span
                                            className={`text-sm ${currentStep === index ? "text-[#B69559]" : "text-[#5a5c61]"}`}
                                        >
                                            {step.number}
                                        </span>
                                    )}
                                </motion.div>
                                <span
                                    className={`mt-2 text-xs text-center ${currentStep === index ? "text-[#122337]" : "text-[#5a5c61]"}`}
                                >
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Warning de campos a revisar */}
                {hasFieldsToReview && currentStep === 2 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#C7664C]/10 border border-[#C7664C]/30 rounded-lg p-4 flex items-start gap-3"
                    >
                        <AlertTriangle className="w-5 h-5 text-[#C7664C] flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-[#C7664C]">
                                Hay campos marcados para revisión antes de
                                enviar. Asegúrate de verificar la información.
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* Step 0: Información General */}
                <AnimatePresence mode="wait">
                    {currentStep === 0 && (
                        <motion.div
                            key="step0"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <FormSection
                                title="Información General"
                                description="Datos del pedido y cliente"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormDatePicker
                                        label="Fecha"
                                        value={fecha}
                                        onChange={(value) =>
                                            setValue("fecha", value)
                                        }
                                        required
                                    />

                                    <FormInput
                                        label="Orden de Compra (Interno)"
                                        required
                                        {...register("oc_interno", {
                                            required: true,
                                        })}
                                        error={
                                            errors.oc_interno
                                                ? "Campo obligatorio"
                                                : ""
                                        }
                                        valid={
                                            !!ocInterno && !errors.oc_interno
                                        }
                                        aiStatus={fieldsAI.oc_interno}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput
                                        label="Orden de Compra Cliente"
                                        type="text"
                                        required
                                        {...register("oc_cliente", {
                                            required: true,
                                            pattern: /^[0-9]+$/,
                                        })}
                                        error={
                                            errors.oc_cliente
                                                ? "Solo números permitidos"
                                                : ""
                                        }
                                        valid={
                                            !!ocCliente &&
                                            /^[0-9]+$/.test(ocCliente)
                                        }
                                        placeholder="Solo números"
                                        aiStatus={fieldsAI.oc_cliente}
                                    />

                                    <FormSelect
                                        label="Cliente"
                                        required
                                        options={clientes}
                                        name={clienteField.name}
                                        onBlur={clienteField.onBlur}
                                        value={clienteId || ""}
                                        onChange={(e) =>
                                            handleClienteChange(e.target.value)
                                        }
                                        error={
                                            errors.id_cliente
                                                ? "Campo obligatorio"
                                                : ""
                                        }
                                        aiStatus={fieldsAI.id_cliente}
                                        disabled={isLoadingClientes}
                                        placeholder={
                                            isLoadingClientes
                                                ? "Cargando clientes..."
                                                : "Seleccionar..."
                                        }
                                    />
                                </div>

                                {isLoadingClientes && (
                                    <p className="text-sm text-[#5a5c61] flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#122337]" />
                                        Cargando lista de clientes...
                                    </p>
                                )}

                                {!isLoadingClientes && clientesError && (
                                    <p className="text-sm text-[#C7664C]">
                                        {clientesError}
                                    </p>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput
                                        label="Correo Electrónico"
                                        type="email"
                                        {...register("correo")}
                                        value={correo}
                                        placeholder={
                                            isLoadingCliente
                                                ? "Consultando cliente..."
                                                : "Selecciona un cliente"
                                        }
                                    />

                                    <FormInput
                                        label="Número de Contacto"
                                        type="tel"
                                        {...register("telefono")}
                                        value={telefono}
                                        placeholder={
                                            isLoadingCliente
                                                ? "Consultando cliente..."
                                                : "Selecciona un cliente"
                                        }
                                    />
                                </div>

                                {isLoadingCliente && (
                                    <p className="text-sm text-[#5a5c61] flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#122337]" />
                                        Cargando información del cliente...
                                    </p>
                                )}

                                {!isLoadingCliente && clienteInfoError && (
                                    <p className="text-sm text-[#C7664C]">
                                        {clienteInfoError}
                                    </p>
                                )}

                                {!isLoadingCliente &&
                                    !clienteInfoError &&
                                    clienteSeleccionado?.ciudad && (
                                        <p className="text-sm text-[#5a5c61]">
                                            Ciudad: {clienteSeleccionado.ciudad}
                                        </p>
                                    )}
                            </FormSection>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Step 1: Productos */}
                <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            <FormSection
                                title="Tipo de Producto"
                                description="Selecciona si es un producto nuevo o existente"
                            >
                                <FormRadio
                                    label="¿Producto nuevo?"
                                    options={[
                                        {
                                            value: "existente",
                                            label: "No - Producto Existente",
                                        },
                                        {
                                            value: "nuevo",
                                            label: "Sí - Producto Nuevo",
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

                            {tipoProducto === "existente" && (
                                <FormSection
                                    title="Producto Existente"
                                    description="Selecciona de nuestro catálogo"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormSelect
                                            label="Producto"
                                            required
                                            options={productosOptions}
                                            value={newProduct.producto_id}
                                            onChange={(e) =>
                                                handleProductoSelectChange(
                                                    e.target.value,
                                                )
                                            }
                                            aiStatus={fieldsAI.producto_id}
                                            disabled={isLoadingProductos}
                                            placeholder={
                                                isLoadingProductos
                                                    ? "Cargando productos..."
                                                    : "Seleccionar producto..."
                                            }
                                        />

                                        <FormInput
                                            label="Cantidad"
                                            type="number"
                                            min="1"
                                            required
                                            value={newProduct.cantidad}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    cantidad: e.target.value,
                                                })
                                            }
                                            error={
                                                parseInt(newProduct.cantidad) <=
                                                0
                                                    ? "Debe ser mayor a 0"
                                                    : ""
                                            }
                                        />
                                    </div>

                                    {isLoadingProductos && (
                                        <p className="text-sm text-[#5a5c61] flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-[#122337]" />
                                            Cargando lista de productos...
                                        </p>
                                    )}

                                    {!isLoadingProductos && productosError && (
                                        <p className="text-sm text-[#C7664C]">
                                            {productosError}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormInput
                                            label="Costo Unitario"
                                            required
                                            value={newProduct.costo}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    costo: formatCurrency(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                            placeholder="$ 0"
                                        />

                                        <div className="flex items-end">
                                            <button
                                                type="button"
                                                onClick={
                                                    agregarProductoExistente
                                                }
                                                className="w-full px-4 py-2.5 bg-[#B69559] text-white rounded-lg hover:bg-[#a08549] transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-5 h-5" />
                                                Agregar Producto
                                            </button>
                                        </div>
                                    </div>
                                </FormSection>
                            )}

                            {tipoProducto === "nuevo" && (
                                <FormSection
                                    title="Producto Nuevo"
                                    description="Especifica los detalles del nuevo producto"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormSelect
                                            label="Nombre del Producto (Base)"
                                            required
                                            options={MOCK_PRODUCTOS.map(
                                                (p) => ({
                                                    value: p.id,
                                                    label: p.nombre,
                                                }),
                                            )}
                                            value={newProduct.producto_id}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    producto_id: e.target.value,
                                                })
                                            }
                                        />

                                        <FormInput
                                            label="Referencia"
                                            required
                                            value={newProduct.referencia}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    referencia: e.target.value,
                                                })
                                            }
                                            placeholder="Ej: REF-NEW-001"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormInput
                                            label="Modelo"
                                            required
                                            value={newProduct.modelo}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    modelo: e.target.value,
                                                })
                                            }
                                            placeholder="Ej: Premium"
                                        />

                                        <FormInput
                                            label="Tela"
                                            required
                                            value={newProduct.tela}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    tela: e.target.value,
                                                })
                                            }
                                            placeholder="Ej: Algodón Premium"
                                        />

                                        <FormInput
                                            label="Cantidad"
                                            type="number"
                                            min="1"
                                            required
                                            value={newProduct.cantidad}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    cantidad: e.target.value,
                                                })
                                            }
                                            error={
                                                parseInt(newProduct.cantidad) <=
                                                0
                                                    ? "Debe ser mayor a 0"
                                                    : ""
                                            }
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormInput
                                            label="Costo Unitario"
                                            required
                                            value={newProduct.costo}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    costo: formatCurrency(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                            placeholder="$ 0"
                                        />

                                        <div className="flex items-end">
                                            <button
                                                type="button"
                                                onClick={agregarProductoNuevo}
                                                className="w-full px-4 py-2.5 bg-[#B69559] text-white rounded-lg hover:bg-[#a08549] transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-5 h-5" />
                                                Agregar Producto Nuevo
                                            </button>
                                        </div>
                                    </div>
                                </FormSection>
                            )}

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
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Step 2: Confirmación */}
                <AnimatePresence mode="wait">
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <FormSection
                                title="Confirmación"
                                description="Revisa la información antes de enviar"
                            >
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-[#5a5c61]">
                                                Fecha
                                            </p>
                                            <p className="text-sm text-[#2F3339]">
                                                {new Date(
                                                    fecha,
                                                ).toLocaleDateString("es-CO")}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-[#5a5c61]">
                                                Orden de Compra
                                            </p>
                                            <p className="text-sm text-[#2F3339]">
                                                {ocInterno}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-[#5a5c61]">
                                                OC Cliente
                                            </p>
                                            <p className="text-sm text-[#2F3339]">
                                                {ocCliente}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-[#5a5c61]">
                                                Cliente
                                            </p>
                                            <p className="text-sm text-[#2F3339]">
                                                {clienteSeleccionado?.nombre ||
                                                    clienteId ||
                                                    "-"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border-t border-[rgba(47,51,57,0.1)] pt-4">
                                        <p className="text-xs text-[#5a5c61] mb-2">
                                            Productos ({products.length})
                                        </p>
                                        <ProductTable
                                            products={products}
                                            onRemove={eliminarProducto}
                                        />
                                    </div>
                                </div>
                            </FormSection>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="flex gap-4 justify-between sticky bottom-4 bg-[#F6F5F0] p-4 rounded-lg border border-[rgba(47,51,57,0.1)] shadow-lg">
                    <div className="flex gap-3">
                        {currentStep > 0 && (
                            <button
                                type="button"
                                onClick={prevStep}
                                className="px-6 py-2.5 border-2 border-[#2F3339] text-[#2F3339] rounded-lg hover:bg-[#2F3339] hover:text-white transition-colors flex items-center gap-2"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Anterior
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-2.5 text-[#5a5c61] hover:text-[#2F3339] transition-colors"
                            disabled={submitStatus === "loading"}
                        >
                            Cancelar
                        </button>
                    </div>

                    {currentStep < 2 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="px-6 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-colors flex items-center gap-2"
                        >
                            Siguiente
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <>
                            {submitStatus === "idle" && (
                                <button
                                    type="submit"
                                    disabled={products.length === 0}
                                    className="px-6 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[220px] justify-center"
                                >
                                    <Send className="w-5 h-5" />
                                    Enviar a Producción
                                </button>
                            )}

                            {submitStatus === "loading" && (
                                <button
                                    type="button"
                                    disabled
                                    className="px-6 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg flex items-center gap-2 min-w-[220px] justify-center opacity-75 cursor-not-allowed"
                                >
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Enviando...
                                </button>
                            )}

                            {submitStatus === "success" && (
                                <button
                                    type="button"
                                    disabled
                                    className="px-6 py-2.5 bg-[#10b981] text-white rounded-lg flex items-center gap-2 min-w-[220px] justify-center cursor-not-allowed"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    Pedido Enviado
                                </button>
                            )}

                            {submitStatus === "error" && (
                                <button
                                    type="button"
                                    onClick={handleRetry}
                                    className="px-6 py-2.5 bg-white text-[#d4183d] border-2 border-[#d4183d] rounded-lg hover:bg-[#d4183d] hover:text-white transition-colors flex items-center gap-2 min-w-[220px] justify-center"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Reintentar
                                </button>
                            )}
                        </>
                    )}
                </div>
            </form>
        </>
    );
}

export interface Email {
    id: string;
    from: string;
    fromName?: string;
    fromEmail?: string;
    subject: string;
    preview: string;
    receivedAt: Date;
    receivedDateTime?: string;
    isRead?: boolean;
    status: "nuevo" | "procesando_ia" | "listo_revisar" | "enviado";
    hasAttachments: boolean;
    body?: string;
    bodyContentType?: "html" | "text";
}

export interface Cliente {
    id: string;
    nombre: string;
    email: string;
    telefono: string;
    ciudad?: string;
    direccion?: string;
}

export interface Producto {
    id: string;
    sku: string;
    nombre: string;
    modelo: string;
    tela: string;
    referencia: string;
    precio: number;
}

export interface ProductoOrden {
    id: string;
    producto: Producto;
    cantidad: number;
    costo: number;
    autocompletadoPorIA: boolean;
    requiereRevision: boolean;
}

export interface FieldAIStatus {
    autocompletado: boolean;
    requiereRevision: boolean;
    confianza?: "alta" | "media" | "baja";
}

export interface OrdenCompra {
    oc_interno: string;
    oc_cliente: string;
    fecha: string;
    id_cliente: string;
    productos: ProductoOrden[];
    aiStatus?: {
        procesando: boolean;
        completado: boolean;
        error: boolean;
        errorMessage?: string;
    };
    fieldsAI: {
        [key: string]: FieldAIStatus;
    };
}

import type { Cliente, Producto, Email } from "../types";

export const MOCK_CLIENTES: Cliente[] = [
    {
        id: "1",
        nombre: "OREKA",
        email: "contacto@oreka.com",
        telefono: "3001234567",
    },
    {
        id: "2",
        nombre: "TOGO",
        email: "ventas@togo.com",
        telefono: "3009876543",
    },
    {
        id: "3",
        nombre: "NIHAO",
        email: "info@nihao.com",
        telefono: "3005551234",
    },
    {
        id: "4",
        nombre: "SPORTEX",
        email: "pedidos@sportex.com",
        telefono: "3007778899",
    },
    {
        id: "5",
        nombre: "URBAN WEAR",
        email: "orders@urbanwear.com",
        telefono: "3002223344",
    },
];

export const MOCK_PRODUCTOS: Producto[] = [
    {
        id: "1",
        sku: "ORK-001",
        nombre: "Camiseta Premium Black",
        modelo: "Premium",
        tela: "Algodón Premium",
        referencia: "REF-001",
        precio: 85000,
    },
    {
        id: "2",
        sku: "ORK-002",
        nombre: "Camiseta Classic Blue",
        modelo: "Classic",
        tela: "Polyester",
        referencia: "REF-002",
        precio: 72000,
    },
    {
        id: "3",
        sku: "TGO-001",
        nombre: "Pantalón Sport Red",
        modelo: "Sport",
        tela: "Dri-Fit",
        referencia: "REF-003",
        precio: 95000,
    },
    {
        id: "4",
        sku: "TGO-002",
        nombre: "Pantalón Urban White",
        modelo: "Urban",
        tela: "Algodón Peinado",
        referencia: "REF-004",
        precio: 68000,
    },
    {
        id: "5",
        sku: "NHO-001",
        nombre: "Chaqueta Elite Green",
        modelo: "Elite",
        tela: "Microfibra",
        referencia: "REF-005",
        precio: 110000,
    },
    {
        id: "6",
        sku: "NHO-002",
        nombre: "Chaqueta Basic Gray",
        modelo: "Basic",
        tela: "Algodón",
        referencia: "REF-006",
        precio: 55000,
    },
    {
        id: "7",
        sku: "SPX-001",
        nombre: "Sudadera Performance",
        modelo: "Performance",
        tela: "Fleece Premium",
        referencia: "REF-007",
        precio: 125000,
    },
    {
        id: "8",
        sku: "URB-001",
        nombre: "Jogger Urban Style",
        modelo: "Urban",
        tela: "Algodón French Terry",
        referencia: "REF-008",
        precio: 78000,
    },
];

export const MOCK_EMAILS: Email[] = [
    {
        id: "1",
        from: "Juan Pérez - OREKA",
        subject: "Nuevo pedido - Camisetas Premium",
        preview:
            "Hola, necesitamos cotización para 100 unidades de camisetas premium modelo ORK-001...",
        receivedAt: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
        status: "nuevo",
        hasAttachments: true,
        body: `Hola equipo All Star,

Necesitamos procesar el siguiente pedido:

- Producto: Camiseta Premium Black (ORK-001)
- Cantidad: 100 unidades
- Fecha de entrega: 20 de Marzo 2026
- OC Cliente: 12345

Por favor confirmen disponibilidad.

Saludos,
Juan Pérez
OREKA`,
    },
    {
        id: "2",
        from: "María González - TOGO",
        subject: "Pedido urgente pantalones",
        preview: "Necesitamos 50 pantalones TGO-001 para el viernes...",
        receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2h ago
        status: "procesando_ia",
        hasAttachments: false,
        body: `Buen día,

Pedido urgente:
- 50 pantalones Sport Red TGO-001
- OC: 67890
- Entrega: Este viernes

Gracias!
María González
TOGO`,
    },
    {
        id: "3",
        from: "Carlos Ruiz - NIHAO",
        subject: "Cotización chaquetas elite",
        preview: "Buenos días, solicito cotización para chaquetas NHO-001...",
        receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5h ago
        status: "listo_revisar",
        hasAttachments: true,
        body: `Buenos días,

Solicito cotización para:
- 30 Chaquetas Elite Green NHO-001
- OC Cliente: 11223
- Fecha tentativa: 25 Marzo

Adjunto especificaciones.

Carlos Ruiz
NIHAO`,
    },
    {
        id: "4",
        from: "Ana Torres - OREKA",
        subject: "Confirmación pedido anterior",
        preview: "Confirmo el pedido realizado la semana pasada...",
        receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        status: "enviado",
        hasAttachments: false,
        body: `Hola,

Confirmo recepción del pedido OP-123456.
Todo correcto.

Gracias,
Ana Torres
OREKA`,
    },
    {
        id: "5",
        from: "Roberto Sánchez - SPORTEX",
        subject: "Nueva orden - Sudaderas",
        preview: "Solicito 75 sudaderas Performance para stock...",
        receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8h ago
        status: "nuevo",
        hasAttachments: true,
        body: `Hola equipo,

Nueva orden:
- 75 Sudaderas Performance SPX-001
- OC: 99887
- Fecha requerida: 1 Marzo

Adjunto PO.

Roberto Sánchez
SPORTEX`,
    },
    {
        id: "6",
        from: "Laura Martínez - URBAN WEAR",
        subject: "Re-orden Joggers",
        preview: "Necesitamos re-ordenar los joggers urbanos...",
        receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12h ago
        status: "nuevo",
        hasAttachments: false,
        body: `Hola,

Re-orden:
- 120 Joggers Urban Style URB-001
- OC: 55443
- Mismo spec que orden anterior

Laura Martínez
URBAN WEAR`,
    },
];

// Función helper para simular extracción de IA
export function simulateAIExtraction(emailBody: string, emailSubject: string) {
    // Extraer OC del cuerpo
    const ocMatch = emailBody.match(/OC[:\s]+(\d+)/i);
    const oc_cliente = ocMatch ? ocMatch[1] : "";

    // Detectar productos mencionados
    const productos: string[] = [];
    MOCK_PRODUCTOS.forEach((producto) => {
        if (
            emailBody.includes(producto.sku) ||
            emailBody.includes(producto.nombre)
        ) {
            productos.push(producto.id);
        }
    });

    // Detectar cantidad
    const cantidadMatch = emailBody.match(
        /(\d+)\s*(unidades?|pantalon|camiseta|chaqueta|sudadera|jogger)/i,
    );
    const cantidad = cantidadMatch ? parseInt(cantidadMatch[1]) : 1;

    // Detectar cliente del remitente
    let id_cliente = "";
    MOCK_CLIENTES.forEach((cliente) => {
        if (
            emailSubject.includes(cliente.nombre) ||
            emailBody.includes(cliente.nombre)
        ) {
            id_cliente = cliente.id;
        }
    });

    return {
        oc_cliente,
        productos,
        cantidad,
        id_cliente,
        confianza: oc_cliente && productos.length > 0 ? "alta" : "media",
    };
}

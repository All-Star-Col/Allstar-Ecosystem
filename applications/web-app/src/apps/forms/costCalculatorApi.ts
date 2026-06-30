import { API_SERVER } from "@/config/api";
import { getToken } from "@/core/auth/auth.service";

export interface CostCalculatorProductSummary {
    id: number;
    nombre: string;
    costo?: number | string | null;
}

export interface CostCalculatorProductDetail extends CostCalculatorProductSummary {
    id_tela?: number | null;
    tela_nombre?: string | null;
    tela_referencia?: string | null;
    tela_label?: string | null;
    tela_costo?: number | string | null;
}

export interface CostCalculatorMaterialSummary {
    id: number;
    nombre: string;
    costo?: number | string | null;
    estado?: boolean | null;
}

export interface CostCalculatorBreakdownMaterial {
    position: number;
    material_id: number;
    material_nombre: string;
    cantidad: number | string;
    costo_unitario: number | string;
    costo_total: number | string;
}

export interface CostCalculatorBreakdown {
    exists: boolean;
    product: CostCalculatorProductDetail;
    despiece_id?: number | null;
    materials: CostCalculatorBreakdownMaterial[];
    cantidad_tela: number | string;
    tela_costo_unitario: number | string;
    tela_costo_total: number | string;
    costo_mano_obra: number | string;
    costo_total_materiales: number | string;
    costo_calculado: number | string;
}

export interface CostCalculatorMaterialInput {
    material_id: number;
    cantidad: number;
}

export interface CostCalculatorBreakdownPayload {
    materials: CostCalculatorMaterialInput[];
    cantidad_tela: number;
    costo_mano_obra: number;
}

function authHeaders(json = false): HeadersInit {
    const token = getToken();
    return {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function readApiError(response: Response, fallback: string): Promise<Error> {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    if (typeof detail === "string" && detail.trim()) {
        return new Error(detail);
    }
    return new Error(fallback);
}

export async function fetchCostCalculatorProducts(params: {
    query?: string;
    limit?: number;
} = {}): Promise<CostCalculatorProductSummary[]> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set("q", params.query);
    if (params.limit) searchParams.set("limit", String(params.limit));

    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/products${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
        }`,
        { headers: authHeaders() },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudieron cargar productos.");
    }

    const payload = (await response.json()) as { items?: CostCalculatorProductSummary[] };
    return payload.items ?? [];
}

export async function fetchCostCalculatorProduct(
    productId: number | string,
): Promise<CostCalculatorProductDetail> {
    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/products/${encodeURIComponent(
            String(productId),
        )}`,
        { headers: authHeaders() },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudo cargar el producto.");
    }

    return (await response.json()) as CostCalculatorProductDetail;
}

export async function updateCostCalculatorManualCost(params: {
    productId: number | string;
    newCost: number;
}): Promise<CostCalculatorProductDetail> {
    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/products/${encodeURIComponent(
            String(params.productId),
        )}/manual-cost`,
        {
            method: "PATCH",
            headers: authHeaders(true),
            body: JSON.stringify({ new_cost: params.newCost }),
        },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudo actualizar el costo.");
    }

    return (await response.json()) as CostCalculatorProductDetail;
}

export async function fetchCostCalculatorBreakdown(
    productId: number | string,
): Promise<CostCalculatorBreakdown> {
    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/products/${encodeURIComponent(
            String(productId),
        )}/breakdown`,
        { headers: authHeaders() },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudo cargar el despiece.");
    }

    return (await response.json()) as CostCalculatorBreakdown;
}

export async function saveCostCalculatorBreakdown(params: {
    productId: number | string;
    payload: CostCalculatorBreakdownPayload;
}): Promise<CostCalculatorBreakdown> {
    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/products/${encodeURIComponent(
            String(params.productId),
        )}/breakdown`,
        {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify(params.payload),
        },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudo guardar el despiece.");
    }

    return (await response.json()) as CostCalculatorBreakdown;
}

export async function updateCostCalculatorLaborCost(params: {
    productId: number | string;
    laborCost: number;
}): Promise<CostCalculatorBreakdown> {
    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/products/${encodeURIComponent(
            String(params.productId),
        )}/labor-cost`,
        {
            method: "PATCH",
            headers: authHeaders(true),
            body: JSON.stringify({ costo_mano_obra: params.laborCost }),
        },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudo actualizar la mano de obra.");
    }

    return (await response.json()) as CostCalculatorBreakdown;
}

export async function applyCostCalculatorCalculatedCost(
    productId: number | string,
): Promise<{
    status: string;
    product: CostCalculatorProductDetail;
    breakdown: CostCalculatorBreakdown;
}> {
    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/products/${encodeURIComponent(
            String(productId),
        )}/apply-calculated-cost`,
        {
            method: "POST",
            headers: authHeaders(true),
        },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudo aplicar el costo calculado.");
    }

    return (await response.json()) as {
        status: string;
        product: CostCalculatorProductDetail;
        breakdown: CostCalculatorBreakdown;
    };
}

export async function fetchCostCalculatorMaterials(params: {
    query?: string;
    limit?: number;
} = {}): Promise<CostCalculatorMaterialSummary[]> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set("q", params.query);
    if (params.limit) searchParams.set("limit", String(params.limit));

    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/materials${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
        }`,
        { headers: authHeaders() },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudieron cargar materiales.");
    }

    const payload = (await response.json()) as { items?: CostCalculatorMaterialSummary[] };
    return payload.items ?? [];
}

export async function createCostCalculatorMaterial(params: {
    nombre: string;
    costo: number;
}): Promise<CostCalculatorMaterialSummary> {
    const response = await fetch(
        `${API_SERVER}/workspace/forms/cost-calculator/materials`,
        {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify(params),
        },
    );

    if (!response.ok) {
        throw await readApiError(response, "No se pudo crear el material.");
    }

    return (await response.json()) as CostCalculatorMaterialSummary;
}

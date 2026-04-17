import { API_SERVER } from "@/config/api";
import { getToken } from "@/core/auth/auth.service";

export interface WorkspaceSessionResponse {
    username: string;
    full_name?: string;
    role_code?: string | null;
    is_admin?: boolean;
}

export interface AdminUser {
    id: string;
    username: string;
    full_name?: string | null;
    email?: string | null;
    is_active: boolean;
    is_email_verified: boolean;
}

export interface CreateAdminUserPayload {
    username: string;
    full_name: string;
    email: string;
    password: string;
}

export interface UpdateAdminUserPayload {
    username?: string;
    full_name?: string;
    email?: string;
    is_active?: boolean;
    password?: string;
}

type UsersListResponse = {
    list_users?: AdminUser[];
} | null;

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

async function readErrorMessage(response: Response): Promise<string> {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
        try {
            const payload: unknown = await response.json();
            if (isObject(payload) && typeof payload.detail === "string") {
                return payload.detail;
            }
        } catch {
            // Ignore parse errors and fallback to default message.
        }
    }

    return `Error en la solicitud (${response.status}).`;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
    const token = getToken();
    if (!token) {
        throw new Error("No hay una sesión activa.");
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
    };

    if (init.body) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_SERVER}${path}`, {
        ...init,
        headers,
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response));
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
        return undefined as T;
    }

    return (await response.json()) as T;
}

export async function fetchWorkspaceSession(): Promise<WorkspaceSessionResponse> {
    return request<WorkspaceSessionResponse>("/workspace", { method: "GET" });
}

export async function fetchAdminUsers(
    limit = 200,
    offset = 0,
): Promise<AdminUser[]> {
    const data = await request<UsersListResponse>(
        `/workspace/users/?limit=${limit}&offset=${offset}`,
        { method: "GET" },
    );

    if (!data) {
        throw new Error("No tienes permisos para administrar usuarios.");
    }

    return Array.isArray(data.list_users) ? data.list_users : [];
}

export async function createAdminUser(
    payload: CreateAdminUserPayload,
): Promise<void> {
    await request<void>("/workspace/users/", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function updateAdminUser(
    userId: string,
    payload: UpdateAdminUserPayload,
): Promise<void> {
    await request<void>(`/workspace/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

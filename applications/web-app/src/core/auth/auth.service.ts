import { API_SERVER } from "@/config/api";

export function getToken() {
    return (
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token")
    );
}

export function isAuthenticated() {
    return Boolean(getToken());
}

export function clearToken() {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
}

export type VerifyTokenResult =
    | { ok: true; status: number }
    | { ok: false; status: number | null; reason: "unauthorized" | "server" | "network" };

export async function verifyToken(): Promise<VerifyTokenResult> {
    const token = getToken();
    if (!token) return { ok: false, status: null, reason: "unauthorized" };

    try {
        const response = await fetch(`${API_SERVER}/workspace`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) return { ok: true, status: response.status };
        if (response.status === 401 || response.status === 403) {
            return { ok: false, status: response.status, reason: "unauthorized" };
        }
        return { ok: false, status: response.status, reason: "server" };
    } catch {
        return { ok: false, status: null, reason: "network" };
    }
}


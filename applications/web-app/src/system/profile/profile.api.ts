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
    role_id?: string | null;
    role_code?: string | null;
    role_name?: string | null;
    role?: {
        id?: string | null;
        code?: string | null;
        name?: string | null;
    } | null;
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

export interface WorkspaceRole {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    is_active?: boolean;
}

export interface RoleAppPermission {
    app_id: string;
    app_name: string;
    app_description?: string | null;
    app_path?: string | null;
    can_view: boolean;
}

export interface RoleTablePermission {
    table_id: string;
    table_name: string;
    table_label?: string | null;
    can_view: boolean;
    can_edit: boolean;
    can_create: boolean;
}

export interface RolePermissionsBundle {
    apps: RoleAppPermission[];
    tables: RoleTablePermission[];
}

type UsersListResponse = {
    list_users?: AdminUser[];
} | null;

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

class ApiRequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiRequestError";
        this.status = status;
    }
}

const readString = (...values: unknown[]): string | undefined => {
    for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }

    return undefined;
};

const readIdentifier = (...values: unknown[]): string | undefined => {
    for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
    }

    return undefined;
};

const readBoolean = (value: unknown, fallback = false): boolean => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value === 1;
    }
    if (typeof value === "string") {
        const normalizedValue = value.trim().toLowerCase();
        if (normalizedValue === "true" || normalizedValue === "1") {
            return true;
        }
        if (normalizedValue === "false" || normalizedValue === "0") {
            return false;
        }
    }

    return fallback;
};

const asArray = (value: unknown): unknown[] => {
    return Array.isArray(value) ? value : [];
};

const pickFirstArray = (...values: unknown[]): unknown[] => {
    for (const value of values) {
        if (Array.isArray(value)) {
            return value;
        }
    }

    return [];
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

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_SERVER}${path}`, {
        ...init,
        headers,
    });

    if (!response.ok) {
        throw new ApiRequestError(response.status, await readErrorMessage(response));
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

type RequestAttempt = {
    path: string;
    init: RequestInit;
    fallbackStatuses?: number[];
};

async function requestWithFallback<T>(attempts: RequestAttempt[]): Promise<T> {
    let lastError: unknown = null;

    for (const attempt of attempts) {
        try {
            return await request<T>(attempt.path, attempt.init);
        } catch (error) {
            if (
                error instanceof ApiRequestError &&
                Array.isArray(attempt.fallbackStatuses) &&
                attempt.fallbackStatuses.includes(error.status)
            ) {
                lastError = error;
                continue;
            }

            throw error;
        }
    }

    if (lastError instanceof Error) {
        throw lastError;
    }

    throw new Error("No fue posible completar la solicitud.");
}

const normalizeRolesPayload = (payload: unknown): WorkspaceRole[] => {
    const directItems = asArray(payload);

    const objectPayload = isObject(payload) ? payload : null;
    const nestedData = isObject(objectPayload?.data) ? objectPayload.data : null;

    const items = directItems.length
        ? directItems
        : pickFirstArray(
              objectPayload?.roles,
              objectPayload?.list_roles,
              objectPayload?.items,
              objectPayload?.results,
              objectPayload?.data,
              nestedData?.roles,
              nestedData?.list_roles,
              nestedData?.items,
          );

    return items
        .map((item) => {
            if (!isObject(item)) {
                return null;
            }

            const id = readString(item.id, item.role_id);
            const code = readString(item.code);
            const name = readString(item.name, item.role_name, item.label);

            if (!id || !code || !name) {
                return null;
            }

            return {
                id,
                code,
                name,
                description:
                    typeof item.description === "string" ? item.description : null,
                is_active: readBoolean(item.is_active, true),
            } satisfies WorkspaceRole;
        })
        .filter((item): item is WorkspaceRole => item !== null);
};

const normalizeRoleAppsPayload = (payload: unknown): RoleAppPermission[] => {
    const directItems = asArray(payload);
    const objectPayload = isObject(payload) ? payload : null;
    const nestedData = isObject(objectPayload?.data) ? objectPayload.data : null;

    const items = directItems.length
        ? directItems
        : pickFirstArray(
              objectPayload?.role_apps,
              objectPayload?.apps,
              objectPayload?.permissions,
              objectPayload?.items,
              objectPayload?.results,
              nestedData?.role_apps,
              nestedData?.apps,
              nestedData?.permissions,
          );

    return items
        .map((item) => {
            if (!isObject(item)) {
                return null;
            }

            const appData = isObject(item.app) ? item.app : null;
            const appId = readIdentifier(item.app_id, item.id, appData?.id);
            const appName = readString(
                item.app_name,
                item.name,
                item.label,
                appData?.name,
            );

            if (!appId) {
                return null;
            }

            return {
                app_id: appId,
                app_name: appName ?? appId,
                app_description:
                    readString(item.app_description, item.description, appData?.description) ??
                    null,
                app_path: readString(item.app_path, item.path, appData?.path) ?? null,
                can_view: readBoolean(
                    item.can_view ?? item.visible ?? item.canView,
                    true,
                ),
            } satisfies RoleAppPermission;
        })
        .filter((item): item is RoleAppPermission => item !== null);
};

const normalizeRoleTablesPayload = (payload: unknown): RoleTablePermission[] => {
    const directItems = asArray(payload);
    const objectPayload = isObject(payload) ? payload : null;
    const nestedData = isObject(objectPayload?.data) ? objectPayload.data : null;

    const items = directItems.length
        ? directItems
        : pickFirstArray(
              objectPayload?.role_tables,
              objectPayload?.tables,
              objectPayload?.permissions,
              objectPayload?.items,
              objectPayload?.results,
              nestedData?.role_tables,
              nestedData?.tables,
              nestedData?.permissions,
          );

    return items
        .map((item) => {
            if (!isObject(item)) {
                return null;
            }

            const tableData = isObject(item.table) ? item.table : null;
            const tableId = readIdentifier(
                item.table_id,
                item.id,
                item.ui_table_id,
                tableData?.id,
            );
            const tableName = readString(
                item.table_name,
                item.nombre_tabla_sql,
                item.name,
                tableData?.table_name,
                tableData?.nombre_tabla_sql,
            );

            if (!tableId) {
                return null;
            }

            return {
                table_id: tableId,
                table_name: tableName ?? tableId,
                table_label:
                    readString(
                        item.table_label,
                        item.nombre_tabla_ui,
                        item.display_name,
                        tableData?.table_label,
                        tableData?.nombre_tabla_ui,
                        tableData?.display_name,
                    ) ?? null,
                can_view: readBoolean(
                    item.can_view ?? item.visible ?? item.canView,
                    true,
                ),
                can_edit: readBoolean(item.can_edit ?? item.edit ?? item.canEdit, false),
                can_create: readBoolean(
                    item.can_create ?? item.create ?? item.canCreate,
                    false,
                ),
            } satisfies RoleTablePermission;
        })
        .filter((item): item is RoleTablePermission => item !== null);
};

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

export async function fetchWorkspaceRoles(): Promise<WorkspaceRole[]> {
    const payload = await requestWithFallback<unknown>([
        {
            path: "/workspace/users/roles",
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: "/workspace/roles/",
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: "/workspace/roles",
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
    ]);

    return normalizeRolesPayload(payload);
}

export async function fetchAdminUserRole(
    userId: string,
): Promise<WorkspaceRole | null> {
    const payload = await requestWithFallback<unknown>([
        {
            path: `/workspace/users/${userId}/role`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/users/${userId}/roles`,
            init: { method: "GET" },
        },
    ]);

    if (payload === null || payload === undefined) {
        return null;
    }

    if (isObject(payload) && payload.role) {
        const [role] = normalizeRolesPayload([payload.role]);
        return role ?? null;
    }

    const [role] = normalizeRolesPayload([payload]);
    return role ?? null;
}

const toTablePayloadId = (tableId: string): string | number => {
    const numericValue = Number(tableId);
    if (Number.isInteger(numericValue) && String(numericValue) === tableId) {
        return numericValue;
    }

    return tableId;
};

export async function assignAdminUserRole(
    userId: string,
    roleId: string,
): Promise<void> {
    const body = JSON.stringify({ role_id: roleId, roleId });

    await requestWithFallback<void>([
        {
            path: `/workspace/users/${userId}/role`,
            init: { method: "PUT", body },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/users/${userId}/role`,
            init: { method: "PATCH", body },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/users/${userId}/roles`,
            init: { method: "PUT", body },
        },
    ]);
}

export async function fetchRoleAppsPermissions(
    roleId: string,
): Promise<RoleAppPermission[]> {
    const payload = await requestWithFallback<unknown>([
        {
            path: `/workspace/users/roles/${roleId}/permissions`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/roles/${roleId}/permissions`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/roles/${roleId}/apps`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/roles/${roleId}/permissions/apps`,
            init: { method: "GET" },
        },
    ]);

    return normalizeRoleAppsPayload(payload);
}

export async function fetchRolePermissions(
    roleId: string,
): Promise<RolePermissionsBundle> {
    const payload = await requestWithFallback<unknown>([
        {
            path: `/workspace/users/roles/${roleId}/permissions`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/roles/${roleId}/permissions`,
            init: { method: "GET" },
        },
    ]);

    return {
        apps: normalizeRoleAppsPayload(payload),
        tables: normalizeRoleTablesPayload(payload),
    };
}

export async function saveRoleAppsPermissions(
    roleId: string,
    permissions: RoleAppPermission[],
): Promise<void> {
    const rows = permissions.map((permission) => ({
        app_id: permission.app_id,
        can_view: permission.can_view,
    }));

    const combinedBody = JSON.stringify({
        apps: rows,
        tables: [],
    });

    const body = JSON.stringify({
        role_apps: rows,
        apps: rows,
        permissions: rows,
    });

    await requestWithFallback<void>([
        {
            path: `/workspace/users/roles/${roleId}/permissions`,
            init: { method: "PUT", body: combinedBody },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/permissions`,
            init: { method: "PUT", body: combinedBody },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/apps`,
            init: { method: "PUT", body },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/apps`,
            init: { method: "PATCH", body },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/permissions/apps`,
            init: { method: "PUT", body },
        },
    ]);
}

export async function fetchRoleTablesPermissions(
    roleId: string,
): Promise<RoleTablePermission[]> {
    const payload = await requestWithFallback<unknown>([
        {
            path: `/workspace/users/roles/${roleId}/permissions`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/roles/${roleId}/permissions`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/roles/${roleId}/tables`,
            init: { method: "GET" },
            fallbackStatuses: [404],
        },
        {
            path: `/workspace/roles/${roleId}/permissions/tables`,
            init: { method: "GET" },
        },
    ]);

    return normalizeRoleTablesPayload(payload);
}

export async function saveRoleTablesPermissions(
    roleId: string,
    permissions: RoleTablePermission[],
): Promise<void> {
    const rows = permissions.map((permission) => ({
        table_id: toTablePayloadId(permission.table_id),
        visible: permission.can_view,
        can_edit: permission.can_edit,
        can_create: permission.can_create,
    }));

    const combinedBody = JSON.stringify({
        apps: [],
        tables: rows,
    });

    const legacyRows = rows.map((row) => ({
        ...row,
        can_view: row.visible,
        edit: row.can_edit,
        create: row.can_create,
    }));

    const body = JSON.stringify({
        role_tables: legacyRows,
        tables: legacyRows,
        permissions: legacyRows,
    });

    await requestWithFallback<void>([
        {
            path: `/workspace/users/roles/${roleId}/permissions`,
            init: { method: "PUT", body: combinedBody },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/permissions`,
            init: { method: "PUT", body: combinedBody },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/tables`,
            init: { method: "PUT", body },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/tables`,
            init: { method: "PATCH", body },
            fallbackStatuses: [404, 405],
        },
        {
            path: `/workspace/roles/${roleId}/permissions/tables`,
            init: { method: "PUT", body },
        },
    ]);
}

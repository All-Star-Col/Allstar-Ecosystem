import React from "react";
import { motion } from "motion/react";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    RefreshCcw,
    Search,
    ShieldCheck,
    UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import QuickLoading from "@/shared/components/QuickLoading";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/table";
import {
    type AdminUser,
    type RoleAppPermission,
    type RoleFormPermission,
    type RoleTablePermission,
    type UpdateAdminUserPayload,
    type WorkspaceRole,
    assignAdminUserRole,
    createAdminUser,
    fetchAdminUsers,
    fetchAdminUserRole,
    fetchRolePermissions,
    fetchWorkspaceRoles,
    fetchWorkspaceSession,
    saveRoleAppsPermissions,
    saveRoleFormsPermissions,
    saveRoleTablesPermissions,
    updateAdminUser,
} from "./profile.api";

type StatusTone = "success" | "error" | "info";

type StatusMessage = {
    tone: StatusTone;
    text: string;
};

type EditFormState = {
    username: string;
    full_name: string;
    email: string;
    role_id: string;
    is_active: boolean;
    password: string;
};

type CreateFormState = {
    username: string;
    full_name: string;
    email: string;
    password: string;
};

const EMPTY_CREATE_FORM: CreateFormState = {
    username: "",
    full_name: "",
    email: "",
    password: "",
};

const toErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return fallback;
};

const resolveUserRoleId = (
    user: AdminUser | null,
    roles: WorkspaceRole[],
): string => {
    if (!user) {
        return "";
    }

    if (typeof user.role_id === "string" && user.role_id.trim()) {
        return user.role_id;
    }

    if (
        user.role &&
        typeof user.role.id === "string" &&
        user.role.id.trim().length > 0
    ) {
        return user.role.id;
    }

    const roleCode =
        (typeof user.role_code === "string" && user.role_code.trim()) ||
        (typeof user.role?.code === "string" && user.role.code.trim()) ||
        "";

    if (!roleCode) {
        return "";
    }

    const roleMatch = roles.find((role) => role.code === roleCode);
    return roleMatch?.id ?? "";
};

const mapUserToEditForm = (
    user: AdminUser | null,
    roleId: string,
): EditFormState => {
    return {
        username: user?.username ?? "",
        full_name: user?.full_name ?? "",
        email: user?.email ?? "",
        role_id: roleId,
        is_active: user?.is_active ?? true,
        password: "",
    };
};

export default function Profile() {
    const navigate = useNavigate();

    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [roles, setRoles] = React.useState<WorkspaceRole[]>([]);

    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
    const [selectedPermissionsRoleId, setSelectedPermissionsRoleId] =
        React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");

    const [editForm, setEditForm] = React.useState<EditFormState>(
        mapUserToEditForm(null, ""),
    );
    const [createForm, setCreateForm] = React.useState<CreateFormState>(
        EMPTY_CREATE_FORM,
    );

    const [roleAppPermissions, setRoleAppPermissions] = React.useState<
        RoleAppPermission[]
    >([]);
    const [roleTablePermissions, setRoleTablePermissions] = React.useState<
        RoleTablePermission[]
    >([]);
    const [roleFormPermissions, setRoleFormPermissions] = React.useState<
        RoleFormPermission[]
    >([]);

    const [statusMessage, setStatusMessage] = React.useState<StatusMessage | null>(
        null,
    );

    const [isBootstrapping, setIsBootstrapping] = React.useState(true);
    const [isRefreshingUsers, setIsRefreshingUsers] = React.useState(false);
    const [isLoadingRoles, setIsLoadingRoles] = React.useState(false);
    const [isSavingChanges, setIsSavingChanges] = React.useState(false);
    const [isCreatingUser, setIsCreatingUser] = React.useState(false);

    const [isLoadingRolePermissions, setIsLoadingRolePermissions] =
        React.useState(false);
    const [isSavingRoleApps, setIsSavingRoleApps] = React.useState(false);
    const [isSavingRoleTables, setIsSavingRoleTables] = React.useState(false);
    const [isSavingRoleForms, setIsSavingRoleForms] = React.useState(false);

    const permissionsRequestRef = React.useRef(0);

    const selectedUser = React.useMemo(() => {
        if (!selectedUserId) {
            return null;
        }

        return users.find((user) => user.id === selectedUserId) ?? null;
    }, [users, selectedUserId]);

    const selectedPermissionsRole = React.useMemo(() => {
        if (!selectedPermissionsRoleId) {
            return null;
        }

        return roles.find((role) => role.id === selectedPermissionsRoleId) ?? null;
    }, [roles, selectedPermissionsRoleId]);

    React.useEffect(() => {
        const inferredRoleId = resolveUserRoleId(selectedUser, roles);
        setEditForm(mapUserToEditForm(selectedUser, inferredRoleId));

        if (!selectedUser || inferredRoleId) {
            return;
        }

        let cancelled = false;

        const hydrateUserRole = async () => {
            try {
                const userRole = await fetchAdminUserRole(selectedUser.id);
                if (cancelled || !userRole) {
                    return;
                }

                setEditForm((prev) => ({
                    ...prev,
                    role_id: userRole.id,
                }));
            } catch {
                // Ignore to avoid noisy UI when role endpoint is unavailable.
            }
        };

        void hydrateUserRole();

        return () => {
            cancelled = true;
        };
    }, [roles, selectedUser]);

    const filteredUsers = React.useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery) {
            return users;
        }

        return users.filter((user) => {
            const searchable = `${user.full_name ?? ""} ${user.username} ${user.email ?? ""}`
                .trim()
                .toLowerCase();
            return searchable.includes(normalizedQuery);
        });
    }, [searchQuery, users]);

    const refreshUsers = React.useCallback(
        async (preferredUserId?: string | null): Promise<AdminUser[] | null> => {
            setIsRefreshingUsers(true);
            try {
                const nextUsers = await fetchAdminUsers();
                setUsers(nextUsers);
                setSelectedUserId((currentUserId) => {
                    const candidateUserId = preferredUserId ?? currentUserId;
                    if (
                        candidateUserId &&
                        nextUsers.some((user) => user.id === candidateUserId)
                    ) {
                        return candidateUserId;
                    }

                    return nextUsers[0]?.id ?? null;
                });

                return nextUsers;
            } catch (error) {
                setStatusMessage({
                    tone: "error",
                    text: toErrorMessage(
                        error,
                        "No se pudo cargar la lista de usuarios.",
                    ),
                });
                return null;
            } finally {
                setIsRefreshingUsers(false);
            }
        },
        [],
    );

    const refreshRoles = React.useCallback(async (): Promise<WorkspaceRole[] | null> => {
        setIsLoadingRoles(true);
        try {
            const nextRoles = await fetchWorkspaceRoles();
            setRoles(nextRoles);
            setSelectedPermissionsRoleId((currentRoleId) => {
                if (currentRoleId && nextRoles.some((role) => role.id === currentRoleId)) {
                    return currentRoleId;
                }

                return nextRoles[0]?.id ?? null;
            });

            return nextRoles;
        } catch (error) {
            setStatusMessage({
                tone: "error",
                text: toErrorMessage(error, "No se pudieron cargar los roles."),
            });
            return null;
        } finally {
            setIsLoadingRoles(false);
        }
    }, []);

    const loadRolePermissions = React.useCallback(async (roleId: string) => {
        const requestId = permissionsRequestRef.current + 1;
        permissionsRequestRef.current = requestId;

        setIsLoadingRolePermissions(true);

        try {
            const permissions = await fetchRolePermissions(roleId);

            if (permissionsRequestRef.current !== requestId) {
                return;
            }

            setRoleAppPermissions(permissions.apps);
            setRoleTablePermissions(permissions.tables);
            setRoleFormPermissions(permissions.forms);
        } catch (error) {
            if (permissionsRequestRef.current !== requestId) {
                return;
            }

            setRoleAppPermissions([]);
            setRoleTablePermissions([]);
            setRoleFormPermissions([]);
            setStatusMessage({
                tone: "error",
                text: toErrorMessage(
                    error,
                    "No se pudieron cargar los permisos del rol seleccionado.",
                ),
            });
        } finally {
            if (permissionsRequestRef.current === requestId) {
                setIsLoadingRolePermissions(false);
            }
        }
    }, []);

    React.useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            try {
                const workspaceData = await fetchWorkspaceSession();
                if (cancelled) {
                    return;
                }

                if (!workspaceData.is_admin) {
                    navigate("/dashboard", { replace: true });
                    return;
                }

                await Promise.all([refreshUsers(), refreshRoles()]);
            } catch (error) {
                if (!cancelled) {
                    setStatusMessage({
                        tone: "error",
                        text: toErrorMessage(
                            error,
                            "No fue posible inicializar la vista de perfil.",
                        ),
                    });
                }
            } finally {
                if (!cancelled) {
                    setIsBootstrapping(false);
                }
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [navigate, refreshRoles, refreshUsers]);

    React.useEffect(() => {
        if (!selectedPermissionsRoleId) {
            setRoleAppPermissions([]);
            setRoleTablePermissions([]);
            setRoleFormPermissions([]);
            setIsLoadingRolePermissions(false);
            return;
        }

        void loadRolePermissions(selectedPermissionsRoleId);
    }, [selectedPermissionsRoleId, loadRolePermissions]);

    const handleSaveChanges = React.useCallback(async () => {
        if (!selectedUser) {
            return;
        }

        const payload: UpdateAdminUserPayload = {};

        const nextUsername = editForm.username.trim();
        const nextFullName = editForm.full_name.trim();
        const nextEmail = editForm.email.trim();
        const nextPassword = editForm.password.trim();
        const nextRoleId = editForm.role_id.trim();

        if (nextUsername && nextUsername !== selectedUser.username) {
            payload.username = nextUsername;
        }

        if (nextFullName && nextFullName !== (selectedUser.full_name ?? "")) {
            payload.full_name = nextFullName;
        }

        if (nextEmail && nextEmail !== (selectedUser.email ?? "")) {
            payload.email = nextEmail;
        }

        if (editForm.is_active !== selectedUser.is_active) {
            payload.is_active = editForm.is_active;
        }

        if (nextPassword) {
            if (nextPassword.length < 8) {
                setStatusMessage({
                    tone: "error",
                    text: "La nueva contraseña debe tener al menos 8 caracteres.",
                });
                return;
            }
            payload.password = nextPassword;
        }

        const currentRoleId = resolveUserRoleId(selectedUser, roles);
        const roleChanged = nextRoleId !== currentRoleId;

        if (roleChanged && !nextRoleId) {
            setStatusMessage({
                tone: "error",
                text: "Debes seleccionar un rol válido para el usuario.",
            });
            return;
        }

        if (
            roleChanged &&
            !roles.some((role) => role.id === nextRoleId)
        ) {
            setStatusMessage({
                tone: "error",
                text: "El rol seleccionado no es válido.",
            });
            return;
        }

        if (Object.keys(payload).length === 0 && !roleChanged) {
            setStatusMessage({
                tone: "info",
                text: "No hay cambios pendientes para guardar.",
            });
            return;
        }

        setIsSavingChanges(true);

        try {
            if (Object.keys(payload).length > 0) {
                await updateAdminUser(selectedUser.id, payload);
            }

            if (roleChanged) {
                await assignAdminUserRole(selectedUser.id, nextRoleId);
            }

            const successText =
                roleChanged && Object.keys(payload).length > 0
                    ? "Usuario y rol actualizados correctamente."
                    : roleChanged
                      ? "Rol actualizado correctamente."
                      : "Usuario actualizado correctamente.";

            setStatusMessage({
                tone: "success",
                text: successText,
            });

            await Promise.all([
                refreshUsers(selectedUser.id),
                refreshRoles(),
            ]);
        } catch (error) {
            setStatusMessage({
                tone: "error",
                text: toErrorMessage(error, "No se pudieron guardar los cambios."),
            });
        } finally {
            setIsSavingChanges(false);
        }
    }, [editForm, refreshRoles, refreshUsers, roles, selectedUser]);

    const handleCreateUser = React.useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            const username = createForm.username.trim();
            const fullName = createForm.full_name.trim();
            const email = createForm.email.trim();
            const password = createForm.password.trim();

            if (!username || !fullName || !email || !password) {
                setStatusMessage({
                    tone: "error",
                    text: "Para crear un usuario debes completar todos los campos.",
                });
                return;
            }

            if (password.length < 8) {
                setStatusMessage({
                    tone: "error",
                    text: "La contraseña inicial debe tener al menos 8 caracteres.",
                });
                return;
            }

            setIsCreatingUser(true);
            try {
                await createAdminUser({
                    username,
                    full_name: fullName,
                    email,
                    password,
                });

                setCreateForm(EMPTY_CREATE_FORM);
                setStatusMessage({
                    tone: "success",
                    text: "Usuario creado correctamente.",
                });

                const nextUsers = await refreshUsers();
                const createdUser = nextUsers?.find((user) => user.username === username);
                if (createdUser) {
                    setSelectedUserId(createdUser.id);
                }
            } catch (error) {
                setStatusMessage({
                    tone: "error",
                    text: toErrorMessage(error, "No se pudo crear el usuario."),
                });
            } finally {
                setIsCreatingUser(false);
            }
        },
        [createForm, refreshUsers],
    );

    const handleSaveRoleApps = React.useCallback(async () => {
        if (!selectedPermissionsRoleId) {
            return;
        }

        setIsSavingRoleApps(true);
        try {
            await saveRoleAppsPermissions(selectedPermissionsRoleId, roleAppPermissions);
            setStatusMessage({
                tone: "success",
                text: "Permisos de aplicaciones guardados correctamente.",
            });
            await loadRolePermissions(selectedPermissionsRoleId);
        } catch (error) {
            setStatusMessage({
                tone: "error",
                text: toErrorMessage(
                    error,
                    "No fue posible guardar los permisos de aplicaciones.",
                ),
            });
        } finally {
            setIsSavingRoleApps(false);
        }
    }, [loadRolePermissions, roleAppPermissions, selectedPermissionsRoleId]);

    const handleSaveRoleTables = React.useCallback(async () => {
        if (!selectedPermissionsRoleId) {
            return;
        }

        setIsSavingRoleTables(true);
        try {
            await saveRoleTablesPermissions(
                selectedPermissionsRoleId,
                roleTablePermissions,
            );
            setStatusMessage({
                tone: "success",
                text: "Permisos de tablas guardados correctamente.",
            });
            await loadRolePermissions(selectedPermissionsRoleId);
        } catch (error) {
            setStatusMessage({
                tone: "error",
                text: toErrorMessage(
                    error,
                    "No fue posible guardar los permisos de tablas.",
                ),
            });
        } finally {
            setIsSavingRoleTables(false);
        }
    }, [loadRolePermissions, roleTablePermissions, selectedPermissionsRoleId]);

    const handleSaveRoleForms = React.useCallback(async () => {
        if (!selectedPermissionsRoleId) {
            return;
        }

        setIsSavingRoleForms(true);
        try {
            await saveRoleFormsPermissions(
                selectedPermissionsRoleId,
                roleFormPermissions,
            );
            setStatusMessage({
                tone: "success",
                text: "Permisos de formularios guardados correctamente.",
            });
            await loadRolePermissions(selectedPermissionsRoleId);
        } catch (error) {
            setStatusMessage({
                tone: "error",
                text: toErrorMessage(
                    error,
                    "No fue posible guardar los permisos de formularios.",
                ),
            });
        } finally {
            setIsSavingRoleForms(false);
        }
    }, [loadRolePermissions, roleFormPermissions, selectedPermissionsRoleId]);

    const isStatusError = statusMessage?.tone === "error";

    if (isBootstrapping) {
        return <QuickLoading />;
    }

    return (
        <div
            className="relative isolate min-h-screen w-full flex items-center justify-center p-4 md:p-8
                    bg-[url('@/assets/bg.jpg')] bg-cover bg-center bg-no-repeat"
        >
            <div className="pointer-events-none fixed inset-0 z-0 bg-black/70 backdrop-blur-md" />

            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                className="relative z-10 w-full max-w-[1240px] bg-background border border-border/10 rounded-2xl shadow-lg p-4 md:p-6 lg:p-8"
            >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/dashboard")}
                        className="cursor-pointer"
                    >
                        <ArrowLeft />
                        Volver al dashboard
                    </Button>

                    <Badge
                        variant="outline"
                        className="border-primary/20 bg-primary-5 text-primary"
                    >
                        <ShieldCheck className="size-3.5" />
                        Solo administradores
                    </Badge>
                </div>

                {statusMessage && (
                    <Alert
                        variant={isStatusError ? "destructive" : "default"}
                        className="mb-4 border-border/60"
                    >
                        {isStatusError ? <AlertCircle /> : <CheckCircle2 />}
                        <AlertTitle>
                            {isStatusError ? "Acción no completada" : "Estado"}
                        </AlertTitle>
                        <AlertDescription>{statusMessage.text}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-foreground">
                                Usuarios del sistema
                            </CardTitle>
                            <CardDescription>
                                Busca, selecciona y administra cuentas activas desde un
                                mismo panel.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative min-w-[220px] flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(event) =>
                                            setSearchQuery(event.target.value)
                                        }
                                        placeholder="Buscar por nombre, usuario o email"
                                        className="pl-9"
                                    />
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    loading={isRefreshingUsers}
                                    onClick={() => {
                                        void refreshUsers(selectedUserId);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <RefreshCcw />
                                    Recargar
                                </Button>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border/60">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-left">Usuario</TableHead>
                                            <TableHead className="text-left">Estado</TableHead>
                                            <TableHead className="text-right">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={3}
                                                    className="px-3 py-5 text-center text-sm text-muted-foreground"
                                                >
                                                    No hay usuarios para mostrar con el filtro
                                                    actual.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredUsers.map((user) => {
                                                const isSelected =
                                                    user.id === selectedUserId;

                                                return (
                                                    <TableRow
                                                        key={user.id}
                                                        className={isSelected
                                                            ? "bg-primary-5 hover:bg-primary-10"
                                                            : ""
                                                        }
                                                    >
                                                        <TableCell className="px-3 py-2 text-left">
                                                            <div className="font-medium text-foreground leading-tight">
                                                                {user.full_name ?? "Sin nombre"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                @{user.username}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="px-3 py-2 text-left">
                                                            <Badge
                                                                variant={user.is_active
                                                                    ? "default"
                                                                    : "outline"
                                                                }
                                                                className={user.is_active
                                                                    ? "bg-primary-10 text-primary"
                                                                    : ""
                                                                }
                                                            >
                                                                {user.is_active
                                                                    ? "Activo"
                                                                    : "Inactivo"
                                                                }
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="px-3 py-2 text-right">
                                                            <Button
                                                                type="button"
                                                                variant={isSelected
                                                                    ? "primary"
                                                                    : "ghost"
                                                                }
                                                                size="sm"
                                                                onClick={() =>
                                                                    setSelectedUserId(user.id)
                                                                }
                                                                className="cursor-pointer"
                                                            >
                                                                {isSelected
                                                                    ? "Seleccionado"
                                                                    : "Editar"
                                                                }
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-foreground">
                                Perfil del usuario
                            </CardTitle>
                            <CardDescription>
                                Ajusta datos, activa o desactiva cuentas, define una nueva
                                contraseña temporal y selecciona su rol.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {!selectedUser ? (
                                <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                                    No hay usuarios disponibles para editar.
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-full-name">Nombre completo</Label>
                                        <Input
                                            id="edit-full-name"
                                            value={editForm.full_name}
                                            onChange={(event) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    full_name: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-username">Usuario</Label>
                                        <Input
                                            id="edit-username"
                                            value={editForm.username}
                                            onChange={(event) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    username: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-email">Correo</Label>
                                        <Input
                                            id="edit-email"
                                            type="email"
                                            value={editForm.email}
                                            onChange={(event) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    email: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-role">Rol</Label>
                                        <Select
                                            value={editForm.role_id}
                                            onValueChange={(roleId) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    role_id: roleId,
                                                }))
                                            }
                                            disabled={
                                                isLoadingRoles ||
                                                isSavingChanges ||
                                                roles.length === 0
                                            }
                                        >
                                            <SelectTrigger id="edit-role">
                                                <SelectValue
                                                    placeholder={
                                                        isLoadingRoles
                                                            ? "Cargando roles..."
                                                            : "Selecciona un rol"
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roles.map((role) => (
                                                    <SelectItem key={role.id} value={role.id}>
                                                        {role.name} ({role.code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-2xs text-muted-foreground">
                                            El rol seleccionado reemplaza cualquier rol previo
                                            del usuario.
                                        </p>
                                    </div>

                                    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Cuenta activa
                                            </p>
                                            <p className="text-2xs text-muted-foreground">
                                                Desactiva para bloquear acceso sin eliminar el
                                                registro.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={editForm.is_active}
                                            onCheckedChange={(checked) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    is_active: checked,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-password">
                                            Nueva contraseña (opcional)
                                        </Label>
                                        <Input
                                            id="edit-password"
                                            type="password"
                                            value={editForm.password}
                                            placeholder="Dejar en blanco para mantener la actual"
                                            onChange={(event) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    password: event.target.value,
                                                }))
                                            }
                                        />
                                        <p className="text-2xs text-muted-foreground">
                                            Mínimo 8 caracteres.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="md"
                                            loading={isSavingChanges}
                                            onClick={() => {
                                                void handleSaveChanges();
                                            }}
                                            className="cursor-pointer"
                                        >
                                            Guardar cambios
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="md"
                                            disabled={isSavingChanges}
                                            onClick={() =>
                                                setEditForm(
                                                    mapUserToEditForm(
                                                        selectedUser,
                                                        resolveUserRoleId(selectedUser, roles),
                                                    ),
                                                )
                                            }
                                            className="cursor-pointer"
                                        >
                                            Restablecer
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="mt-4 border-border/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-foreground">
                            Permisos
                        </CardTitle>
                        <CardDescription>
                            Selecciona un rol para administrar permisos por aplicaciones y
                            por tablas y formularios.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="grid gap-4 xl:grid-cols-[280px_1fr]">
                        <div className="rounded-lg border border-border/60 bg-card">
                            <div className="border-b border-border/60 px-3 py-2 text-sm font-medium text-foreground">
                                Roles
                            </div>

                            <div className="max-h-[380px] overflow-y-auto p-2">
                                {isLoadingRoles ? (
                                    <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                                        Cargando roles...
                                    </div>
                                ) : roles.length === 0 ? (
                                    <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                                        No hay roles disponibles para editar.
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {roles.map((role) => {
                                            const isSelectedRole =
                                                role.id === selectedPermissionsRoleId;

                                            return (
                                                <Button
                                                    key={role.id}
                                                    type="button"
                                                    variant={
                                                        isSelectedRole ? "primary" : "ghost"
                                                    }
                                                    size="sm"
                                                    className="w-full justify-start cursor-pointer"
                                                    onClick={() =>
                                                        setSelectedPermissionsRoleId(role.id)
                                                    }
                                                >
                                                    {role.name} ({role.code})
                                                </Button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {!selectedPermissionsRole ? (
                            <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                                Selecciona un rol en la columna izquierda para editar sus
                                permisos.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-border/60 bg-card">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Aplicaciones
                                            </p>
                                            <p className="text-2xs text-muted-foreground">
                                                Define acceso de {selectedPermissionsRole.name} a
                                                cada app.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="primary"
                                            loading={isSavingRoleApps}
                                            disabled={
                                                isLoadingRolePermissions ||
                                                roleAppPermissions.length === 0 ||
                                                isSavingRoleTables
                                            }
                                            onClick={() => {
                                                void handleSaveRoleApps();
                                            }}
                                            className="cursor-pointer"
                                        >
                                            Guardar aplicaciones
                                        </Button>
                                    </div>

                                    {isLoadingRolePermissions ? (
                                        <div className="px-3 py-4 text-sm text-muted-foreground">
                                            Cargando permisos de aplicaciones...
                                        </div>
                                    ) : (
                                        <div className="max-h-[260px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Aplicación</TableHead>
                                                        <TableHead>Ruta</TableHead>
                                                        <TableHead className="text-right">
                                                            Acceso
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {roleAppPermissions.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={3}
                                                                className="text-center text-sm text-muted-foreground"
                                                            >
                                                                No hay aplicaciones configuradas
                                                                para este rol.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        roleAppPermissions.map((permission) => (
                                                            <TableRow key={permission.app_id}>
                                                                <TableCell className="align-middle">
                                                                    <div className="font-medium text-foreground">
                                                                        {permission.app_name}
                                                                    </div>
                                                                    {permission.app_description ? (
                                                                        <div className="text-2xs text-muted-foreground">
                                                                            {
                                                                                permission.app_description
                                                                            }
                                                                        </div>
                                                                    ) : null}
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">
                                                                    {permission.app_path ?? "-"}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="inline-flex items-center gap-2">
                                                                        <span className="text-2xs text-muted-foreground">
                                                                            Ver
                                                                        </span>
                                                                        <Switch
                                                                            checked={
                                                                                permission.can_view
                                                                            }
                                                                            disabled={
                                                                                isSavingRoleApps ||
                                                                                isSavingRoleTables
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) => {
                                                                                setRoleAppPermissions(
                                                                                    (prev) =>
                                                                                        prev.map(
                                                                                            (
                                                                                                item,
                                                                                            ) =>
                                                                                                item.app_id ===
                                                                                                permission.app_id
                                                                                                    ? {
                                                                                                          ...item,
                                                                                                          can_view:
                                                                                                              checked,
                                                                                                      }
                                                                                                    : item,
                                                                                        ),
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-lg border border-border/60 bg-card">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Tablas
                                            </p>
                                            <p className="text-2xs text-muted-foreground">
                                                Controla visibilidad y edición por tabla.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="primary"
                                            loading={isSavingRoleTables}
                                            disabled={
                                                isLoadingRolePermissions ||
                                                roleTablePermissions.length === 0 ||
                                                isSavingRoleApps ||
                                                isSavingRoleForms
                                            }
                                            onClick={() => {
                                                void handleSaveRoleTables();
                                            }}
                                            className="cursor-pointer"
                                        >
                                            Guardar tablas
                                        </Button>
                                    </div>

                                    {isLoadingRolePermissions ? (
                                        <div className="px-3 py-4 text-sm text-muted-foreground">
                                            Cargando permisos de tablas...
                                        </div>
                                    ) : (
                                        <div className="max-h-[260px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Tabla</TableHead>
                                                        <TableHead className="text-right">
                                                            Ver
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            Editar
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            Eliminar
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            Liberar
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {roleTablePermissions.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={5}
                                                                className="text-center text-sm text-muted-foreground"
                                                            >
                                                                No hay tablas configuradas para
                                                                este rol.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        roleTablePermissions.map((permission) => (
                                                            <TableRow key={permission.table_id}>
                                                                <TableCell className="align-middle">
                                                                    <div className="font-medium text-foreground">
                                                                        {
                                                                            permission.table_label ??
                                                                            permission.table_name
                                                                        }
                                                                    </div>
                                                                    {permission.table_label ? (
                                                                        <div className="text-2xs text-muted-foreground">
                                                                            {
                                                                                permission.table_name
                                                                            }
                                                                        </div>
                                                                    ) : null}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="inline-flex items-center justify-end">
                                                                        <Switch
                                                                            checked={
                                                                                permission.can_view
                                                                            }
                                                                            disabled={
                                                                                isSavingRoleTables ||
                                                                                isSavingRoleApps ||
                                                                                isSavingRoleForms
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) => {
                                                                                setRoleTablePermissions(
                                                                                    (prev) =>
                                                                                        prev.map(
                                                                                            (
                                                                                                item,
                                                                                            ) =>
                                                                                                item.table_id ===
                                                                                                permission.table_id
                                                                                                    ? {
                                                                                                          ...item,
                                                                                                          can_view:
                                                                                                              checked,
                                                                                                      }
                                                                                                    : item,
                                                                                        ),
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="inline-flex items-center justify-end">
                                                                        <Switch
                                                                            checked={
                                                                                permission.can_delete
                                                                            }
                                                                            disabled={
                                                                                isSavingRoleTables ||
                                                                                isSavingRoleApps ||
                                                                                isSavingRoleForms
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) => {
                                                                                setRoleTablePermissions(
                                                                                    (prev) =>
                                                                                        prev.map(
                                                                                            (
                                                                                                item,
                                                                                            ) =>
                                                                                                item.table_id ===
                                                                                                permission.table_id
                                                                                                    ? {
                                                                                                          ...item,
                                                                                                          can_delete:
                                                                                                              checked,
                                                                                                      }
                                                                                                    : item,
                                                                                        ),
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="inline-flex items-center justify-end">
                                                                        <Switch
                                                                            checked={
                                                                                permission.can_edit
                                                                            }
                                                                            disabled={
                                                                                isSavingRoleTables ||
                                                                                isSavingRoleApps ||
                                                                                isSavingRoleForms
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) => {
                                                                                setRoleTablePermissions(
                                                                                    (prev) =>
                                                                                        prev.map(
                                                                                            (
                                                                                                item,
                                                                                            ) =>
                                                                                                item.table_id ===
                                                                                                permission.table_id
                                                                                                    ? {
                                                                                                          ...item,
                                                                                                          can_edit:
                                                                                                              checked,
                                                                                                      }
                                                                                                    : item,
                                                                                        ),
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="inline-flex items-center justify-end">
                                                                        <Switch
                                                                            checked={
                                                                                permission.can_release_order_process
                                                                            }
                                                                            disabled={
                                                                                permission.table_id !==
                                                                                    "ordenproceso" ||
                                                                                isSavingRoleTables ||
                                                                                isSavingRoleApps ||
                                                                                isSavingRoleForms
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) => {
                                                                                setRoleTablePermissions(
                                                                                    (prev) =>
                                                                                        prev.map(
                                                                                            (
                                                                                                item,
                                                                                            ) =>
                                                                                                item.table_id ===
                                                                                                permission.table_id
                                                                                                    ? {
                                                                                                          ...item,
                                                                                                          can_release_order_process:
                                                                                                              checked,
                                                                                                      }
                                                                                                    : item,
                                                                                        ),
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-lg border border-border/60 bg-card">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Formularios
                                            </p>
                                            <p className="text-2xs text-muted-foreground">
                                                Controla visualizacion por formulario.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="primary"
                                            loading={isSavingRoleForms}
                                            disabled={
                                                isLoadingRolePermissions ||
                                                roleFormPermissions.length === 0 ||
                                                isSavingRoleApps ||
                                                isSavingRoleTables
                                            }
                                            onClick={() => {
                                                void handleSaveRoleForms();
                                            }}
                                            className="cursor-pointer"
                                        >
                                            Guardar formularios
                                        </Button>
                                    </div>

                                    {isLoadingRolePermissions ? (
                                        <div className="px-3 py-4 text-sm text-muted-foreground">
                                            Cargando permisos de formularios...
                                        </div>
                                    ) : (
                                        <div className="max-h-[260px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Formulario</TableHead>
                                                        <TableHead className="text-right">
                                                            Ver
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {roleFormPermissions.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={2}
                                                                className="text-center text-sm text-muted-foreground"
                                                            >
                                                                No hay formularios configurados para
                                                                este rol.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        roleFormPermissions.map((permission) => (
                                                            <TableRow key={permission.table_id}>
                                                                <TableCell className="align-middle">
                                                                    <div className="font-medium text-foreground">
                                                                        {
                                                                            permission.form_label ??
                                                                            permission.table_name
                                                                        }
                                                                    </div>
                                                                    {permission.form_label ? (
                                                                        <div className="text-2xs text-muted-foreground">
                                                                            {
                                                                                permission.table_name
                                                                            }
                                                                        </div>
                                                                    ) : null}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="inline-flex items-center justify-end">
                                                                        <Switch
                                                                            checked={
                                                                                permission.can_view
                                                                            }
                                                                            disabled={
                                                                                isSavingRoleForms ||
                                                                                isSavingRoleApps ||
                                                                                isSavingRoleTables
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) => {
                                                                                setRoleFormPermissions(
                                                                                    (prev) =>
                                                                                        prev.map(
                                                                                            (
                                                                                                item,
                                                                                            ) =>
                                                                                                item.table_id ===
                                                                                                permission.table_id
                                                                                                    ? {
                                                                                                          ...item,
                                                                                                          can_view:
                                                                                                              checked,
                                                                                                      }
                                                                                                    : item,
                                                                                        ),
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="mt-4 border-border/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <UserPlus className="size-4" />
                            Crear nuevo usuario
                        </CardTitle>
                        <CardDescription>
                            Genera cuentas administrativas u operativas desde este mismo
                            panel.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form
                            onSubmit={(event) => {
                                void handleCreateUser(event);
                            }}
                            className="grid gap-3 md:grid-cols-2"
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="new-full-name">Nombre completo</Label>
                                <Input
                                    id="new-full-name"
                                    value={createForm.full_name}
                                    onChange={(event) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            full_name: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="new-username">Usuario</Label>
                                <Input
                                    id="new-username"
                                    value={createForm.username}
                                    onChange={(event) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            username: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="new-email">Correo</Label>
                                <Input
                                    id="new-email"
                                    type="email"
                                    value={createForm.email}
                                    onChange={(event) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            email: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="new-password">Contraseña inicial</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={createForm.password}
                                    onChange={(event) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            password: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <div className="md:col-span-2 flex justify-end">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    loading={isCreatingUser}
                                    className="min-w-[220px] justify-center"
                                >
                                    Crear usuario
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}

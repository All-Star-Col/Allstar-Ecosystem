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
    type UpdateAdminUserPayload,
    createAdminUser,
    fetchAdminUsers,
    fetchWorkspaceSession,
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

const mapUserToEditForm = (user: AdminUser | null): EditFormState => {
    return {
        username: user?.username ?? "",
        full_name: user?.full_name ?? "",
        email: user?.email ?? "",
        is_active: user?.is_active ?? true,
        password: "",
    };
};

const toErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return fallback;
};

export default function Profile() {
    const navigate = useNavigate();

    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");

    const [editForm, setEditForm] = React.useState<EditFormState>(
        mapUserToEditForm(null),
    );
    const [createForm, setCreateForm] = React.useState<CreateFormState>(
        EMPTY_CREATE_FORM,
    );

    const [statusMessage, setStatusMessage] = React.useState<StatusMessage | null>(
        null,
    );

    const [isBootstrapping, setIsBootstrapping] = React.useState(true);
    const [isRefreshingUsers, setIsRefreshingUsers] = React.useState(false);
    const [isSavingChanges, setIsSavingChanges] = React.useState(false);
    const [isCreatingUser, setIsCreatingUser] = React.useState(false);

    const selectedUser = React.useMemo(() => {
        if (!selectedUserId) {
            return null;
        }

        return users.find((user) => user.id === selectedUserId) ?? null;
    }, [users, selectedUserId]);

    React.useEffect(() => {
        setEditForm(mapUserToEditForm(selectedUser));
    }, [selectedUser]);

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

                await refreshUsers();
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
    }, [navigate, refreshUsers]);

    const handleSaveChanges = React.useCallback(async () => {
        if (!selectedUser) {
            return;
        }

        const payload: UpdateAdminUserPayload = {};

        const nextUsername = editForm.username.trim();
        const nextFullName = editForm.full_name.trim();
        const nextEmail = editForm.email.trim();
        const nextPassword = editForm.password.trim();

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

        if (Object.keys(payload).length === 0) {
            setStatusMessage({
                tone: "info",
                text: "No hay cambios pendientes para guardar.",
            });
            return;
        }

        setIsSavingChanges(true);

        try {
            await updateAdminUser(selectedUser.id, payload);
            setStatusMessage({
                tone: "success",
                text: "Usuario actualizado correctamente.",
            });

            await refreshUsers(selectedUser.id);
        } catch (error) {
            setStatusMessage({
                tone: "error",
                text: toErrorMessage(error, "No se pudieron guardar los cambios."),
            });
        } finally {
            setIsSavingChanges(false);
        }
    }, [editForm, refreshUsers, selectedUser]);

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
                                Ajusta datos, activa o desactiva cuentas y define una nueva
                                contraseña temporal.
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
                                                setEditForm(mapUserToEditForm(selectedUser))
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

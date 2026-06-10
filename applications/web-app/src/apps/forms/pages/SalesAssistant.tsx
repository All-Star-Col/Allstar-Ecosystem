import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Inbox, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
    extractSalesAssistantPreorderAI,
    fetchSalesAssistantPreorders,
    importSalesAssistantEmails,
} from "../api";
import type {
    SalesAssistantAIExtractionAPI,
    SalesAssistantPreorderAPI,
} from "../api";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/table";

function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function parseJsonExtraido(value: SalesAssistantPreorderAPI["json_extraido"]) {
    if (!value) return {};
    if (typeof value === "object") return value as Record<string, unknown>;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function getExtraction(row: SalesAssistantPreorderAPI) {
    const jsonExtraido = parseJsonExtraido(row.json_extraido);
    const extraction = jsonExtraido.extraccion_ia;
    return extraction && typeof extraction === "object"
        ? (extraction as SalesAssistantAIExtractionAPI)
        : null;
}

function getConfidenceLabel(value: number | undefined) {
    if (typeof value !== "number") return "-";
    return `${Math.round(value * 100)}%`;
}

export default function SalesAssistant() {
    const navigate = useNavigate();
    const [preorders, setPreorders] = useState<SalesAssistantPreorderAPI[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [extractingId, setExtractingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const pendingCount = useMemo(
        () =>
            preorders.filter(
                (row) =>
                    String(row.estado ?? "").toUpperCase() ===
                    "PENDIENTE_REVISION",
            ).length,
        [preorders],
    );

    async function loadPreorders() {
        setLoading(true);
        setError(null);
        try {
            setPreorders(await fetchSalesAssistantPreorders(100));
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "No se pudieron cargar las preórdenes.",
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadPreorders();
    }, []);

    async function handleImportEmails() {
        setImporting(true);
        setError(null);
        try {
            const summary = await importSalesAssistantEmails(20);
            toast.success(
                `Creadas: ${summary.preordenes_creadas}. Duplicadas: ${summary.duplicados}. Errores: ${summary.errores}.`,
            );
            await loadPreorders();
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "No se pudieron importar correos.";
            setError(message);
            toast.error(message);
        } finally {
            setImporting(false);
        }
    }

    async function handleExtractAI(row: SalesAssistantPreorderAPI) {
        setExtractingId(row.id);
        setError(null);
        try {
            await extractSalesAssistantPreorderAI(row.id);
            toast.success("Extracción IA completada.");
            await loadPreorders();
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "No se pudo ejecutar la extracción IA.";
            setError(message);
            toast.error(message);
        } finally {
            setExtractingId(null);
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/80 bg-card/80 backdrop-blur">
                <div className="container mx-auto max-w-7xl px-4 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate("/app/forms")}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                            <div className="h-8 w-px bg-border" aria-hidden />
                            <div>
                                <h1 className="text-2xl font-semibold text-foreground">
                                    Asistente IA de OC
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Preórdenes creadas desde correo para revisión de ventas.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void loadPreorders()}
                                disabled={loading}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refrescar
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void handleImportEmails()}
                                disabled={importing}
                            >
                                {importing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Inbox className="mr-2 h-4 w-4" />
                                )}
                                Traer correos
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-7xl px-4 py-6">
                {error && (
                    <Alert variant="destructive" className="mb-5">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="mb-5 grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Preórdenes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {preorders.length}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Pendientes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {pendingCount}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Flujo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Correo → Extracción IA → Revisión → Aprobación
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="h-5 w-5" />
                            Bandeja de preórdenes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground">
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Cargando preórdenes...
                            </div>
                        ) : preorders.length === 0 ? (
                            <div className="py-16 text-center text-muted-foreground">
                                No hay preórdenes cargadas.
                            </div>
                        ) : (
                            <div className="max-h-[64vh] overflow-auto rounded-md border">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-card">
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Remitente</TableHead>
                                            <TableHead>Asunto</TableHead>
                                            <TableHead>Fecha correo</TableHead>
                                            <TableHead>Cliente IA</TableHead>
                                            <TableHead>Items IA</TableHead>
                                            <TableHead>Confianza</TableHead>
                                            <TableHead className="text-right">
                                                Acción
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {preorders.map((row) => {
                                            const extraction = getExtraction(row);
                                            const itemsCount =
                                                extraction?.items?.length ?? 0;
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell className="font-medium">
                                                        {row.id}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {row.estado ?? "-"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[220px] truncate">
                                                        {row.remitente ?? "-"}
                                                    </TableCell>
                                                    <TableCell className="max-w-[280px] truncate">
                                                        {row.asunto ?? "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDate(row.fecha_correo)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {extraction?.cliente ?? "-"}
                                                    </TableCell>
                                                    <TableCell>{itemsCount}</TableCell>
                                                    <TableCell>
                                                        {getConfidenceLabel(
                                                            extraction?.confianza,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={
                                                                extraction
                                                                    ? "outline"
                                                                    : "default"
                                                            }
                                                            onClick={() =>
                                                                void handleExtractAI(row)
                                                            }
                                                            disabled={
                                                                extractingId === row.id
                                                            }
                                                        >
                                                            {extractingId === row.id ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="mr-2 h-4 w-4" />
                                                            )}
                                                            {extraction
                                                                ? "Reextraer"
                                                                : "Extraer IA"}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

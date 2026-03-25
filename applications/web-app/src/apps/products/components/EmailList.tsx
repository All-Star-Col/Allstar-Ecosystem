import {
    Mail,
    Paperclip,
    Loader2,
    CheckCircle2,
    Send,
    ChevronLeft,
    RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import type { Email } from "../types";
import { Button } from "@/shared/ui/button";

interface EmailListProps {
    emails: Email[];
    selectedEmailId: string | null;
    onSelectEmail: (id: string) => void;
    onRefresh?: () => void;
    isLoading?: boolean;
    error?: string;
}

export function EmailList({
    emails,
    selectedEmailId,
    onSelectEmail,
    onRefresh,
    isLoading = false,
    error = "",
}: EmailListProps) {
    const mainAppUrl = import.meta.env.VITE_ALLSTAR_MAIN_APP_URL || "/";

    const getStatusBadge = (status: Email["status"]) => {
        switch (status) {
            case "nuevo":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-foreground rounded text-xs">
                        <Mail className="w-3 h-3" />
                        Nuevo
                    </span>
                );
            case "procesando_ia":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Procesando
                    </span>
                );
            case "listo_revisar":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success rounded text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Listo
                    </span>
                );
            case "enviado":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted-foreground/10 text-muted-foreground rounded text-xs">
                        <Send className="w-3 h-3" />
                        Enviado
                    </span>
                );
        }
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 1) {
            const minutes = Math.floor(diff / (1000 * 60));
            return `Hace ${minutes}m`;
        } else if (hours < 24) {
            return `Hace ${hours}h`;
        } else {
            return date.toLocaleDateString("es-CO", {
                day: "numeric",
                month: "short",
            });
        }
    };

    return (
        <div className="h-full flex flex-col bg-white border-r border-border">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            window.location.href = mainAppUrl;
                        }}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Regresar
                    </Button>

                    <Button
                        variant="outline"
                        size="xs"
                        onClick={onRefresh}
                        disabled={isLoading}
                    >
                        <RefreshCw
                            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
                        />
                        Refrescar
                    </Button>
                </div>
                <h2 className="text-foreground mb-1">Correos de Clientes</h2>
                <p className="text-xs text-muted-foreground">
                    {emails.length} correos
                </p>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                        Cargando correos...
                    </div>
                )}

                {!isLoading && !!error && (
                    <div className="p-4 text-sm text-destructive">{error}</div>
                )}

                {!isLoading && !error && emails.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">
                        No hay correos disponibles.
                    </div>
                )}

                {!isLoading &&
                    !error &&
                    emails.map((email) => {
                        const isSelected = email.id === selectedEmailId;

                        return (
                            <motion.button
                                key={email.id}
                                onClick={() => onSelectEmail(email.id)}
                                className={`
                w-full text-left p-4 border-b border-border
                transition-colors relative
                ${
                    isSelected
                        ? "bg-primary/5 border-l-4 border-l-foreground"
                        : "hover:bg-background/50 border-l-4 border-l-transparent"
                }
                `}
                                whileHover={{ x: isSelected ? 0 : 4 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <p className="text-sm text-secondary-foreground truncate flex-1">
                                        {email.from}
                                    </p>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDate(email.receivedAt)}
                                    </span>
                                </div>

                                <p className="text-xs text-foreground mb-2 truncate">
                                    {email.subject}
                                </p>

                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {email.preview}
                                </p>

                                <div className="flex items-center justify-between">
                                    {getStatusBadge(email.status)}

                                    {email.hasAttachments && (
                                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                                    )}
                                </div>
                            </motion.button>
                        );
                    })}
            </div>
        </div>
    );
}

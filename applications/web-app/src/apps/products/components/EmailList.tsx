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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#122337]/10 text-[#122337] rounded text-xs">
                        <Mail className="w-3 h-3" />
                        Nuevo
                    </span>
                );
            case "procesando_ia":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#B69559]/10 text-[#B69559] rounded text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Procesando
                    </span>
                );
            case "listo_revisar":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#10b981]/10 text-[#10b981] rounded text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Listo
                    </span>
                );
            case "enviado":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#5a5c61]/10 text-[#5a5c61] rounded text-xs">
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
        <div className="h-full flex flex-col bg-white border-r border-[rgba(47,51,57,0.08)]">
            {/* Header */}
            <div className="p-4 border-b border-[rgba(47,51,57,0.08)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            window.location.href = mainAppUrl;
                        }}
                        className="inline-flex items-center gap-1 text-sm text-[#122337] hover:opacity-80 transition-opacity"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Regresar
                    </button>

                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[rgba(47,51,57,0.2)] rounded-md text-[#2F3339] hover:bg-[#F6F5F0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <RefreshCw
                            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
                        />
                        Refrescar
                    </button>
                </div>
                <h2 className="text-[#122337] mb-1">Correos de Clientes</h2>
                <p className="text-xs text-[#5a5c61]">
                    {emails.length} correos
                </p>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="p-4 text-sm text-[#5a5c61] flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#122337]" />
                        Cargando correos...
                    </div>
                )}

                {!isLoading && !!error && (
                    <div className="p-4 text-sm text-[#C7664C]">{error}</div>
                )}

                {!isLoading && !error && emails.length === 0 && (
                    <div className="p-4 text-sm text-[#5a5c61]">
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
                w-full text-left p-4 border-b border-[rgba(47,51,57,0.05)]
                transition-colors relative
                ${
                    isSelected
                        ? "bg-[#122337]/5 border-l-4 border-l-[#122337]"
                        : "hover:bg-[#F6F5F0]/50 border-l-4 border-l-transparent"
                }
                `}
                                whileHover={{ x: isSelected ? 0 : 4 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <p className="text-sm text-[#2F3339] truncate flex-1">
                                        {email.from}
                                    </p>
                                    <span className="text-xs text-[#5a5c61] whitespace-nowrap">
                                        {formatDate(email.receivedAt)}
                                    </span>
                                </div>

                                <p className="text-xs text-[#122337] mb-2 truncate">
                                    {email.subject}
                                </p>

                                <p className="text-xs text-[#5a5c61] mb-2 line-clamp-2">
                                    {email.preview}
                                </p>

                                <div className="flex items-center justify-between">
                                    {getStatusBadge(email.status)}

                                    {email.hasAttachments && (
                                        <Paperclip className="w-3 h-3 text-[#5a5c61]" />
                                    )}
                                </div>
                            </motion.button>
                        );
                    })}
            </div>
        </div>
    );
}

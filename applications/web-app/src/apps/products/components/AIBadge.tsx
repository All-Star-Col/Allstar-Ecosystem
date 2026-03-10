import { Sparkles, AlertCircle } from "lucide-react";

interface AIBadgeProps {
    autocompletado?: boolean;
    requiereRevision?: boolean;
    confianza?: "alta" | "media" | "baja";
}

export function AIBadge({
    autocompletado = false,
    requiereRevision = false,
}: AIBadgeProps) {
    if (!autocompletado && !requiereRevision) return null;

    if (requiereRevision) {
        return (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#C7664C]/10 border border-[#C7664C]/30 rounded text-xs text-[#C7664C]">
                <AlertCircle className="w-3 h-3" />
                Revisar
            </div>
        );
    }

    if (autocompletado) {
        return (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#B69559]/10 border border-[#B69559]/30 rounded text-xs text-[#B69559]">
                <Sparkles className="w-3 h-3" />
                IA
            </div>
        );
    }

    return null;
}

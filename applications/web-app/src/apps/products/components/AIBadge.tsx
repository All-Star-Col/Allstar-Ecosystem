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
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                <AlertCircle className="w-3 h-3" />
                Revisar
            </div>
        );
    }

    if (autocompletado) {
        return (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/30 rounded text-xs text-accent">
                <Sparkles className="w-3 h-3" />
                IA
            </div>
        );
    }

    return null;
}

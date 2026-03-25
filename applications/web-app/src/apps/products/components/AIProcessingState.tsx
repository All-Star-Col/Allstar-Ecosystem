import { Loader2, Sparkles, RefreshCw, Edit3, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/shared/ui/button";

interface AIProcessingStateProps {
    status: "processing" | "completed" | "error";
    errorMessage?: string;
    onRetry?: () => void;
    onManualEdit?: () => void;
}

export function AIProcessingState({
    status,
    errorMessage,
    onRetry,
    onManualEdit,
}: AIProcessingStateProps) {
    if (status === "completed") return null;

    if (status === "processing") {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg p-12 shadow-sm border border-border text-center"
            >
                <div className="relative inline-block mb-6">
                    <Sparkles className="w-20 h-20 text-accent" />
                    <Loader2 className="w-8 h-8 text-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                </div>

                <h3 className="text-xl text-foreground mb-2">
                    Procesando con IA…
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Estamos extrayendo la información del correo y completando
                    el formulario automáticamente. Esto puede tomar unos
                    segundos.
                </p>

                <div className="flex gap-3 justify-center">
                    {onRetry && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRetry}
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reintentar IA
                        </Button>
                    )}

                    {onManualEdit && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onManualEdit}
                        >
                            <Edit3 className="w-4 h-4" />
                            Editar manualmente
                        </Button>
                    )}
                </div>
            </motion.div>
        );
    }

    if (status === "error") {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg p-12 shadow-sm border-2 border-destructive/20 text-center"
            >
                <AlertCircle className="w-20 h-20 text-destructive mx-auto mb-6" />

                <h3 className="text-xl text-foreground mb-2">
                    Error en el procesamiento
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    {errorMessage ||
                        "No pudimos procesar el correo con IA. Puedes reintentarlo o editar manualmente."}
                </p>

                <div className="flex gap-3 justify-center">
                    {onRetry && (
                        <Button
                            variant="default"
                            size="md"
                            onClick={onRetry}
                        >
                            <RefreshCw className="w-5 h-5" />
                            Reintentar IA
                        </Button>
                    )}

                    {onManualEdit && (
                        <Button
                            variant="outline"
                            size="md"
                            onClick={onManualEdit}
                            className="rounded-lg border-2"
                        >
                            <Edit3 className="w-5 h-5" />
                            Editar manualmente
                        </Button>
                    )}
                </div>
            </motion.div>
        );
    }

    return null;
}

import { Loader2, Sparkles, RefreshCw, Edit3, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

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
                className="bg-white rounded-lg p-12 shadow-sm border border-[rgba(47,51,57,0.08)] text-center"
            >
                <div className="relative inline-block mb-6">
                    <Sparkles className="w-20 h-20 text-[#B69559]" />
                    <Loader2 className="w-8 h-8 text-[#122337] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                </div>

                <h3 className="text-xl text-[#122337] mb-2">
                    Procesando con IA…
                </h3>
                <p className="text-sm text-[#5a5c61] mb-6 max-w-md mx-auto">
                    Estamos extrayendo la información del correo y completando
                    el formulario automáticamente. Esto puede tomar unos
                    segundos.
                </p>

                <div className="flex gap-3 justify-center">
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="px-4 py-2 text-sm text-[#5a5c61] hover:text-[#122337] transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reintentar IA
                        </button>
                    )}

                    {onManualEdit && (
                        <button
                            onClick={onManualEdit}
                            className="px-4 py-2 text-sm text-[#5a5c61] hover:text-[#122337] transition-colors flex items-center gap-2"
                        >
                            <Edit3 className="w-4 h-4" />
                            Editar manualmente
                        </button>
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
                className="bg-white rounded-lg p-12 shadow-sm border-2 border-[#C7664C]/20 text-center"
            >
                <AlertCircle className="w-20 h-20 text-[#C7664C] mx-auto mb-6" />

                <h3 className="text-xl text-[#122337] mb-2">
                    Error en el procesamiento
                </h3>
                <p className="text-sm text-[#5a5c61] mb-6 max-w-md mx-auto">
                    {errorMessage ||
                        "No pudimos procesar el correo con IA. Puedes reintentarlo o editar manualmente."}
                </p>

                <div className="flex gap-3 justify-center">
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="px-6 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Reintentar IA
                        </button>
                    )}

                    {onManualEdit && (
                        <button
                            onClick={onManualEdit}
                            className="px-6 py-2.5 border-2 border-[#2F3339] text-[#2F3339] rounded-lg hover:bg-[#2F3339] hover:text-white transition-colors flex items-center gap-2"
                        >
                            <Edit3 className="w-5 h-5" />
                            Editar manualmente
                        </button>
                    )}
                </div>
            </motion.div>
        );
    }

    return null;
}

import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
}: ConfirmationModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-[#122337]/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                            }}
                            className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-[#122337] text-[#F6F5F0] px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-[#B69559]" />
                                    <h3 className="text-lg">
                                        Confirmar envío a producción
                                    </h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-[#F6F5F0]/70 hover:text-[#F6F5F0] transition-colors"
                                    disabled={isLoading}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <p className="text-[#2F3339] leading-relaxed">
                                    ¿Estás seguro de enviar este pedido a
                                    producción? Esta acción generará una{" "}
                                    <span className="font-medium text-[#122337]">
                                        Orden de Producción (OP)
                                    </span>
                                    .
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="bg-[#F6F5F0] px-6 py-4 flex gap-3 justify-end">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="px-5 py-2.5 border-2 border-[#2F3339] text-[#2F3339] rounded-lg hover:bg-[#2F3339] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className="px-5 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                                >
                                    {isLoading
                                        ? "Procesando..."
                                        : "Confirmar Envío"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

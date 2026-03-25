import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/shared/ui/button";

const MODAL_TRANSITION = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
};

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
                        className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={MODAL_TRANSITION}
                            className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-accent" />
                                    <h3 className="text-lg">
                                        Confirmar envío a producción
                                    </h3>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="text-primary-foreground/70 hover:text-primary-foreground"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <p className="text-secondary-foreground leading-relaxed">
                                    ¿Estás seguro de enviar este pedido a
                                    producción? Esta acción generará una{" "}
                                    <span className="font-medium text-foreground">
                                        Orden de Producción (OP)
                                    </span>
                                    .
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="bg-primary-foreground px-6 py-4 flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="rounded-lg border-2"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="default"
                                    size="md"
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className="min-w-[140px]"
                                >
                                    {isLoading
                                        ? "Procesando..."
                                        : "Confirmar Envío"}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

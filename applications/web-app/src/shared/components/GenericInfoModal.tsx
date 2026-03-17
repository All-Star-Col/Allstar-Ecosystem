import { useId, useRef, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, X } from "lucide-react";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";

interface GenericInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message?: string;
    returnFocusRef?: RefObject<HTMLElement | null>;
}

export const GenericInfoModal = ({
    isOpen,
    onClose,
    title,
    message = "proximamente",
    returnFocusRef,
}: GenericInfoModalProps) => {
    const titleId = useId();
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const { dialogRef } = useAccessibleDialog({
        isOpen,
        onClose,
        initialFocusRef: closeButtonRef,
        returnFocusRef,
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-[#122337]/60 backdrop-blur-sm z-50"
                    />

                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <motion.div
                            ref={dialogRef}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                            }}
                            className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={titleId}
                            tabIndex={-1}
                        >
                            <div className="bg-[#122337] text-[#F6F5F0] px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bell className="w-6 h-6 text-[#B69559]" />
                                    <h3 id={titleId} className="text-lg">
                                        {title}
                                    </h3>
                                </div>
                                <button
                                    ref={closeButtonRef}
                                    type="button"
                                    onClick={onClose}
                                    className="text-[#F6F5F0]/70 hover:text-[#F6F5F0] transition-colors"
                                    aria-label={`Cerrar modal ${title}`}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                <p className="text-[#2F3339] leading-relaxed">
                                    {message}
                                </p>
                            </div>

                            <div className="bg-[#F6F5F0] px-6 py-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 bg-[#122337] text-[#F6F5F0] rounded-lg hover:bg-[#1a3352] transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

import { useId, useRef, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, X } from "lucide-react";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";
import { Button } from "@/shared/ui/button";

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
    message = "Próximamente...",
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
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
                    />

                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            ref={dialogRef}
                            initial={{ opacity: 0, scale: 0.98, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 16 }}
                            transition={{
                                type: "spring",
                                stiffness: 320,
                                damping: 34,
                            }}
                            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_24px_80px_rgba(18,35,55,0.16)] backdrop-blur-xl"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={titleId}
                            tabIndex={-1}
                        >

                            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 text-primary">
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 id={titleId} className="text-base font-semibold leading-tight text-foreground">
                                            {title}
                                        </h3>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Información general
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    ref={closeButtonRef}
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={onClose}
                                    className="rounded-full border border-border/70 bg-background/80 text-foreground/70 transition-colors hover:bg-primary/5 hover:text-foreground"
                                    aria-label={`Cerrar modal ${title}`}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="px-5 py-5 sm:px-6">
                                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
                                    <p className="text-sm leading-relaxed text-foreground/80">
                                        {message}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

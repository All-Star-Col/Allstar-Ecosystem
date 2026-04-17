import { type MouseEvent, useRef, useState } from "react";
import { motion } from "motion/react";
import { Bell, Power, Settings, type LucideIcon } from "lucide-react";
import { GenericInfoModal } from "../../../shared/components/GenericInfoModal";
// import { duration, stagger } from "../../../shared/animations";

const IconButton = ({
    icon: Icon,
    hoverRotate = 0,
    ariaLabel,
    onClick,
}: {
    icon: LucideIcon;
    hoverRotate?: number;
    ariaLabel: string;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) => (
    <motion.button
        type="button"
        whileHover={{ scale: 1.1, rotate: hoverRotate }}
        whileTap={{ scale: 0.95 }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary-foreground hover:bg-secondary/10 transition-colors cursor-pointer border-none"
        aria-label={ariaLabel}
        onClick={onClick}
    >
        <Icon size={18} />
    </motion.button>
);

export function Footer() {
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const modalTriggerRef = useRef<HTMLElement | null>(null);

    const handleLogOut = () => {
        localStorage.removeItem("access_token");
        sessionStorage.removeItem("access_token");
        window.location.href = "/login";
    };

    const handleOpenInfoModal = (
        title: string,
        event: MouseEvent<HTMLButtonElement>,
    ) => {
        modalTriggerRef.current = event.currentTarget;
        setModalTitle(title);
        setIsInfoModalOpen(true);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="flex items-center justify-between mt-auto pt-4 border-t border-border/50"
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    className="text-xs text-muted-foreground"
                >
                    Versión 1.0.0 - © 2026 Sistema Corporativo
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    className="flex items-center gap-4"
                >
                    <IconButton
                        icon={Bell}
                        hoverRotate={15}
                        ariaLabel="Abrir notificaciones"
                        onClick={(event) =>
                            handleOpenInfoModal("Notificaciones", event)
                        }
                    />
                    <IconButton
                        icon={Settings}
                        hoverRotate={90}
                        ariaLabel="Abrir configuracion"
                        onClick={(event) =>
                            handleOpenInfoModal("Configuración", event)
                        }
                    />

                    <motion.button
                        type="button"
                        initial="rest"
                        whileHover="hover"
                        whileTap="tap"
                        className="group relative flex items-center h-8 px-3 rounded-lg text-destructive text-[13px] font-medium cursor-pointer border-none overflow-hidden"
                        onClick={handleLogOut}
                    >
                        <motion.span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-lg bg-destructive/10"
                            variants={{
                                rest: { scale: 1, opacity: 1 },
                                hover: { scale: 1.06, opacity: 1 },
                                tap: { scale: 0.98, opacity: 1 },
                            }}
                            transition={{ duration: 0.2 }}
                        />

                        <span className="relative z-10 flex items-center gap-2">
                            <motion.span
                                className="flex items-center"
                                variants={{
                                    rest: { rotate: 0 },
                                    hover: { rotate: 180 },
                                    tap: { rotate: 0 },
                                }}
                                transition={{ duration: 0.3 }}
                            >
                                <Power size={16} />
                            </motion.span>
                            <span>SALIR</span>
                        </span>
                    </motion.button>
                </motion.div>
            </motion.div>

            <GenericInfoModal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                title={modalTitle}
                returnFocusRef={modalTriggerRef}
            />
        </>
    );
}

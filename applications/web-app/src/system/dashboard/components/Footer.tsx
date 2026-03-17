import { type MouseEvent, useRef, useState } from "react";
import { motion } from "motion/react";
import { Bell, Power, Settings, type LucideIcon } from "lucide-react";
import { GenericInfoModal } from "../../../shared/components/GenericInfoModal";

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
        className="flex items-center justify-center transition-all"
        style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#2f3339",
        }}
        onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(47, 51, 57, 0.08)")
        }
        onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
        }
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
                className="flex items-center justify-between mt-auto pt-4"
                style={{ borderTop: "1px solid rgba(47, 51, 57, 0.08)" }}
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    style={{ fontSize: "12px", color: "rgba(47, 51, 57, 0.6)" }}
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
                            handleOpenInfoModal("Configuracion", event)
                        }
                    />

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 transition-all"
                        onClick={handleLogOut}
                        style={{
                            height: "32px",
                            padding: "0 12px",
                            borderRadius: "8px",
                            backgroundColor: "rgba(199, 102, 76, 0.08)",
                            border: "none",
                            cursor: "pointer",
                            color: "#C7664C",
                            fontSize: "13px",
                            fontWeight: 500,
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                                "rgba(199, 102, 76, 0.15)")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                                "rgba(199, 102, 76, 0.08)")
                        }
                    >
                        <motion.div
                            whileHover={{ rotate: 180 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Power size={16} />
                        </motion.div>
                        SALIR
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

import { motion } from "motion/react";
import { Bell, Settings, Power } from "lucide-react";

const IconButton = ({
    icon: Icon,
    hoverRotate = 0,
}: {
    icon: any;
    hoverRotate?: number;
}) => (
    <motion.button
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
    >
        <Icon size={18} />
    </motion.button>
);

export function Footer() {
    const handleLogOut = () => {
        localStorage.removeItem("access_token");
        sessionStorage.removeItem("access_token");
        window.location.href = "/login";
    };

    return (
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
                <IconButton icon={Bell} hoverRotate={15} />
                <IconButton icon={Settings} hoverRotate={90} />

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
    );
}

import { motion } from "framer-motion";
import { getIconComponent } from "./IconComponent";
import { useNavigate } from "react-router-dom";

interface AppTileProps {
    name: string;
    icon: string;
    iconBgColor: string;
    badge?: number;
    badgeColor?: string;
    index?: number;
    path: string;
}

export function AppTile({
    name,
    icon,
    iconBgColor,
    badge,
    badgeColor,
    index = 0,
    path,
}: AppTileProps) {
    const navigate = useNavigate();

    const handlePage = () => {
        const isExternalUrl = /^https?:\/\//i.test(path);
        if (isExternalUrl) {
            window.location.href = path;
            return;
        }

        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        console.log("Navigating to page:", normalizedPath);
        navigate(normalizedPath);
    };

    const IconComponent = getIconComponent(icon);
    return (
        <motion.div
            onClick={handlePage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: index * 0.05,
                ease: [0.23, 1, 0.32, 1],
            }}
            whileHover={{
                y: -4,
                transition: { duration: 0.2 },
            }}
            whileTap={{ scale: 0.97 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
            style={{
                width: "120px",
                height: "92px",
                borderRadius: "16px",
                backgroundColor: "#f6f5f0",
                border: "1px solid rgba(47, 51, 57, 0.1)",
                boxShadow: "0 6px 14px rgba(47, 51, 57, 0.08)",
                padding: "12px",
            }}
        >
            {/* Badge */}
            {badge !== undefined && badge > 0 && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                        delay: index * 0.05 + 0.3,
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                    }}
                    className="absolute flex items-center justify-center"
                    style={{
                        top: "8px",
                        right: "8px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: badgeColor,
                        color: "#f6f5f0",
                        fontSize: "10px",
                        fontWeight: 600,
                    }}
                >
                    <motion.span
                        animate={{
                            scale: [1, 1.1, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 3,
                        }}
                    >
                        {badge}
                    </motion.span>
                </motion.div>
            )}

            {/* Icon Circle */}
            <motion.div
                whileHover={{
                    scale: 1.1,
                    rotate: 5,
                    transition: { duration: 0.2 },
                }}
                className="flex items-center justify-center mb-2"
                style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: iconBgColor,
                }}
            >
                <IconComponent size={20} color={badgeColor} />
            </motion.div>

            {/* Name */}
            <div
                style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#2f3339",
                    textAlign: "center",
                }}
            >
                {name}
            </div>
        </motion.div>
    );
}

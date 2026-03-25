import { motion, AnimatePresence } from "motion/react";
import { getIconComponent } from "./IconComponent";
import { useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { Star } from "lucide-react";

interface AppTileProps {
    id: string;
    name: string;
    icon: string;
    iconBgColor: string;
    badge?: number;
    badgeColor?: string;
    index?: number;
    path: string;
    externalUrl?: string | null;
    onAccess?: (appId: string) => void;
    onFavoriteToggle?: (appId: string, isFavorited: boolean) => void;
    favoriteColor?: string;
    unfavoriteColor?: string;
}

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

export function AppTitle({
    id,
    name,
    icon,
    iconBgColor,
    badge,
    badgeColor,
    index = 0,
    path,
    externalUrl,
    onAccess,
    onFavoriteToggle,
    isFavorited: initialIsFavorited,
    favoriteColor,
    unfavoriteColor,
}: AppTileProps & { isFavorited?: boolean }) {
    const navigate = useNavigate();
    const [isFavorited, setIsFavorited] = useState(initialIsFavorited ?? false);

    const toggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        const favorites = JSON.parse(
            localStorage.getItem("favorite-apps") || "[]",
        );
        const updated = favorites.includes(id)
            ? favorites.filter((favId: string) => favId !== id)
            : [...favorites, id];
        localStorage.setItem("favorite-apps", JSON.stringify(updated));
        setIsFavorited(!isFavorited);
        onFavoriteToggle?.(id, !isFavorited);
    };

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "favorite-apps") {
                const favorites = e.newValue ? JSON.parse(e.newValue) : [];
                setIsFavorited(favorites.includes(id));
            }
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, [id]);

    const handlePage = useCallback(() => {
        if (externalUrl) {
            window.open(externalUrl, "_blank", "noopener,noreferrer");
            return;
        }
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        navigate(normalizedPath);
        onAccess?.(id);
    }, [id, path, externalUrl, navigate, onAccess]);

    const IconComponent = getIconComponent(icon);

    return (
        <motion.div
            layout
            onClick={handlePage}
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{
                layout: { duration: 0.38, ease: EASE },
                duration: 0.32,
                delay: index * 0.04,
                ease: EASE,
            }}
            whileHover={{ y: -4, transition: { duration: 0.18, ease: EASE } }}
            whileTap={{ scale: 0.96 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
            style={{
                width: "120px",
                height: "92px",
                borderRadius: "16px",
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                boxShadow: "0 6px 14px rgba(47, 51, 57, 0.08)",
                padding: "12px",
            }}
        >
            {/* Star toggle */}
            <motion.div
                onClick={toggleFavorite}
                className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 cursor-pointer z-10"
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.75 }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {isFavorited ? (
                        <motion.div
                            key="starred"
                            initial={{ scale: 0, rotate: -40 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: EASE }}
                        >
                            <Star
                                size={13}
                                fill={favoriteColor ?? "#ffd700"}
                                color={favoriteColor ?? "#ffd700"}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="unstarred"
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.4, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <Star size={13} color={unfavoriteColor ?? "#ccc"} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Badge */}
            {badge !== undefined && badge > 0 && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                        delay: index * 0.04 + 0.3,
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
                        color: "var(--primary-foreground)",
                        fontSize: "10px",
                        fontWeight: 600,
                    }}
                >
                    <motion.span
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                        {badge}
                    </motion.span>
                </motion.div>
            )}

            {/* Icon */}
            <motion.div
                whileHover={{ scale: 1.1, rotate: 5, transition: { duration: 0.18 } }}
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
                    color: "var(--secondary-foreground)",
                    textAlign: "center",
                }}
            >
                {name}
            </div>
        </motion.div>
    );
}

import { motion } from "motion/react";

interface TabChipsProps {
    selectedTab: string;
    onTabChange: (tab: string) => void;
}

const tabs = [
    { id: "todas", label: "Todas" },
    { id: "favorites", label: "Favoritas" },
    { id: "recientes", label: "Recientes" },
];

const EASE_SPRING: [number, number, number, number] = [0.23, 1, 0.32, 1];

export function TabChips({ selectedTab, onTabChange }: TabChipsProps) {
    return (
        <motion.div className="flex gap-2">
            {tabs.map((tab, index) => {
                const isActive = selectedTab === tab.id;
                return (
                    <motion.button
                        key={tab.id}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}

                        transition={{
                            duration: 0.3,
                            ease: EASE_SPRING,
                            delay: index * 0.06,
                        }}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onTabChange(tab.id)}
                        className={`relative h-8 px-3 rounded-full text-[13px] font-medium border-none cursor-pointer overflow-hidden ${
                            isActive
                                ? "text-primary-foreground"
                                : "bg-muted text-secondary-foreground hover:bg-muted/70"
                        }`}
                    >
                        {isActive && (
                            <motion.span
                                layoutId="activeTab"
                                className="absolute inset-0 rounded-full bg-primary"
                                transition={{
                                    duration: 0.3,
                                    ease: EASE_SPRING,
                                }}
                            />
                        )}

                        <span className="relative z-10">{tab.label}</span>
                    </motion.button>
                );
            })}
        </motion.div>
    );
}
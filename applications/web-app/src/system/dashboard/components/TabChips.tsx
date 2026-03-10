import { motion } from "motion/react";

interface TabChipsProps {
    selectedTab: string;
    onTabChange: (tab: string) => void;
}

const tabs = [
    { id: "top-apps", label: "Top apps" },
    { id: "recientes", label: "Recientes" },
    { id: "todas", label: "Todas" },
];

export function TabChips({ selectedTab, onTabChange }: TabChipsProps) {
    return (
        <div className="flex gap-2">
            {tabs.map((tab, index) => (
                <motion.button
                    key={tab.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        height: "32px",
                        padding: "6px 12px",
                        borderRadius: "16px",
                        backgroundColor:
                            selectedTab === tab.id
                                ? "#122337"
                                : "rgba(47, 51, 57, 0.08)",
                        color: selectedTab === tab.id ? "#f6f5f0" : "#2f3339",
                        fontSize: "13px",
                        fontWeight: 500,
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        position: "relative",
                    }}
                >
                    {tab.label}
                    {selectedTab === tab.id && (
                        <motion.div
                            layoutId="activeTab"
                            style={{
                                position: "absolute",
                                inset: 0,
                                backgroundColor: "#122337",
                                borderRadius: "16px",
                                zIndex: -1,
                            }}
                        />
                    )}
                </motion.button>
            ))}
        </div>
    );
}

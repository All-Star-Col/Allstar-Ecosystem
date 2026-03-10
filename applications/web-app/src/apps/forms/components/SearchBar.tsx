import { motion } from "motion/react";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="flex items-center gap-2"
            style={{
                width: "300px",
                height: "38px",
                borderRadius: "19px",
                backgroundColor: "#f6f5f0",
                border: "1px solid rgba(47, 51, 57, 0.12)",
                padding: "0 16px",
            }}
        >
            <motion.svg
                animate={{ rotate: value ? [0, 10, -10, 0] : 0 }}
                transition={{ duration: 0.3 }}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(47, 51, 57, 0.6)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </motion.svg>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Buscar aplicaciones…"
                style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    backgroundColor: "transparent",
                    fontSize: "14px",
                    color: "#2f3339",
                }}
            />
        </motion.div>
    );
}

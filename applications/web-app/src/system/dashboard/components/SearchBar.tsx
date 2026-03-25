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
            className="flex items-center gap-2 w-[300px] h-9 rounded-full bg-background border border-border/70 px-4"
        >
            <motion.svg
                animate={{ rotate: value ? [0, 10, -10, 0] : 0 }}
                transition={{ duration: 0.3 }}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
            >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </motion.svg>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Buscar aplicaciones…"
                className="flex-1 border-none outline-none bg-transparent text-sm text-secondary-foreground placeholder:text-muted-foreground"
            />
        </motion.div>
    );
}

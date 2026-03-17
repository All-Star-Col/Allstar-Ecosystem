import { motion } from "motion/react";
import { Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/ui/utils";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    showClear?: boolean;
    autoFocus?: boolean;
}

export function SearchBar({
    value,
    onChange,
    placeholder = "Buscar tablas...",
    className,
    showClear = true,
    autoFocus,
}: SearchBarProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className={cn("relative w-full", className)}
        >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className={cn("h-10 rounded-full bg-muted/40 pl-9 pr-10 shadow-sm")}
            />

            {showClear && value.trim().length > 0 && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange("")}
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar búsqueda"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </motion.div>
    );
}

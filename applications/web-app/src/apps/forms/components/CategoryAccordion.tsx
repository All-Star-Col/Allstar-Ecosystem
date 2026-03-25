import { useMemo, useState } from "react";
import type { Category, TableSchema } from "../schema";
import { TableCard } from "./TableCard";
import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    Boxes,
    ClipboardList,
    Database,
    Factory,
    FileText,
    Folder,
    Settings,
    Shield,
    Truck,
    Users,
    Wrench,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CategoryAccordionProps {
    category: Category;
    tables: TableSchema[];
    onTableSelect: (table: TableSchema) => void;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const CATEGORY_ICON_SET: LucideIcon[] = [
    Folder,
    FileText,
    ClipboardList,
    Database,
    Users,
    Boxes,
    Truck,
    Factory,
    Wrench,
    Settings,
    Shield,
    BarChart3,
];

function hashString(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

export function CategoryAccordion({
    category,
    tables,
    onTableSelect,
    isOpen: isOpenProp,
    onOpenChange,
}: CategoryAccordionProps) {
    const [internalIsOpen, setInternalIsOpen] = useState(true);
    const isControlled = typeof isOpenProp === "boolean";
    const isOpen = isControlled ? isOpenProp : internalIsOpen;

    const setIsOpen = (nextOpen: boolean) => {
        if (!isControlled) {
            setInternalIsOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };
    const iconIndex = useMemo(() => {
        const key = category.id?.trim() || category.nombre?.trim() || "category";
        return Math.abs(hashString(key)) % CATEGORY_ICON_SET.length;
    }, [category.id, category.nombre]);
    const Icon = CATEGORY_ICON_SET[iconIndex] ?? Folder;

    return (
        <div className="rounded-xl border border-border/80 bg-card/90 shadow-none overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-primary/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg border border-primary/30 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>

                    <div className="text-left">
                        <h3 className="text-base font-semibold leading-tight text-foreground">
                            {category.nombre}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {category.description ?? "Colección de tablas"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                        {tables.length} {tables.length === 1 ? "tabla" : "tablas"}
                    </span>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full border border-primary/30 bg-primary/10 text-primary">
                        {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-foreground" />
                        )}
                    </div>
                </div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="border-t border-border/80 bg-primary/3 p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {tables.map((table) => (
                                <TableCard
                                    key={table.id}
                                    table={table}
                                    onClick={() => onTableSelect(table)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

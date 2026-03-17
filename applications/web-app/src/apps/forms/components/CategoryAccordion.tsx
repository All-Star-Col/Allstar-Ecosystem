import { useState } from "react";
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

function getCategoryIcon(category: Category) {
    const key = category.id?.trim() || category.nombre?.trim() || "category";
    const idx = Math.abs(hashString(key)) % CATEGORY_ICON_SET.length;
    return CATEGORY_ICON_SET[idx] ?? Folder;
}

export function CategoryAccordion({
    category,
    tables,
    onTableSelect,
}: CategoryAccordionProps) {
    const [isOpen, setIsOpen] = useState(true);
    const Icon = getCategoryIcon(category);

    return (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>

                    <div className="text-left">
                        <h3 className="text-lg">{category.nombre}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground tabular-nums">
                        {tables.length} {tables.length === 1 ? "tabla" : "tablas"}
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/60">
                        {isOpen ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                        ) : (
                            <ChevronRight className="h-5 w-5 text-primary" />
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
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20">
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

import { useState } from "react";
import type { Category, TableSchema } from "../schema";
import { TableCard } from "./TableCard";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CategoryAccordionProps {
    category: Category;
    name: string;
    tables: TableSchema[];
    onTableSelect: (table: TableSchema) => void;
}

export function CategoryAccordion({
    name,
    tables,
    onTableSelect,
}: CategoryAccordionProps) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                        {isOpen ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                        ) : (
                            <ChevronRight className="h-5 w-5 text-primary" />
                        )}
                    </div>

                    <div className="text-left">
                        <h3 className="text-lg">{name}</h3>
                    </div>
                </div>
                <div className="text-sm text-muted-foreground">
                    {tables.length} {tables.length === 1 ? "tabla" : "tablas"}
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

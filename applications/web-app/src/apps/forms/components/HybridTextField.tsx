import { useState } from "react";
import type { ColumnSchema } from "../schema";
import { fetchColumnValues } from "../api";
import { FOREIGN_KEY_REMOTE_DEFAULT_LIMIT } from "../foreignKey";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { AsyncForeignKeyCombobox } from "./DynamicFormField";

type HybridMode = "selection" | "free_text";

interface HybridTextFieldProps {
    column: ColumnSchema;
    value: unknown;
    onChange: (value: string) => void;
    tableName: string;
}

export function HybridTextField({
    column,
    value,
    onChange,
    tableName,
}: HybridTextFieldProps) {
    const [mode, setMode] = useState<HybridMode>("selection");

    const textValue = value === undefined || value === null ? "" : String(value);

    // Seed the combobox with the current value so it always shows the selected label
    const seedOptions = textValue ? [{ value: textValue, label: textValue }] : [];

    const handleLookup = async (query: string, limit: number) => {
        return fetchColumnValues({
            tableName,
            columnName: column.name,
            query,
            limit,
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant={mode === "selection" ? "default" : "outline"}
                    onClick={() => setMode("selection")}
                >
                    Selección
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={mode === "free_text" ? "default" : "outline"}
                    onClick={() => setMode("free_text")}
                >
                    Texto libre
                </Button>
            </div>

            {mode === "selection" ? (
                <AsyncForeignKeyCombobox
                    value={textValue}
                    options={seedOptions}
                    onChange={onChange}
                    onLookup={handleLookup}
                    limit={FOREIGN_KEY_REMOTE_DEFAULT_LIMIT}
                    hasError={false}
                />
            ) : (
                <Input
                    id={column.name}
                    type="text"
                    value={textValue}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={column.placeholder}
                    maxLength={column.maxLength}
                />
            )}
        </div>
    );
}

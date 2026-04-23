import { useEffect, useMemo, useState } from "react";
import type { ColumnSchema } from "../schema";
import { fetchForeignKeyLookup } from "../api";
import { FOREIGN_KEY_REMOTE_DEFAULT_LIMIT } from "../foreignKey";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";

type HybridMode = "selection" | "free_text";

interface HybridTextFieldProps {
    column: ColumnSchema;
    value: unknown;
    onChange: (value: string) => void;
    tableName: string;
}

interface LookupOption {
    value: string;
    label: string;
}

function deduplicateByLabel(options: LookupOption[]): LookupOption[] {
    const optionsByLabel = new Map<string, LookupOption>();

    options.forEach((option) => {
        if (!optionsByLabel.has(option.label)) {
            optionsByLabel.set(option.label, option);
        }
    });

    return Array.from(optionsByLabel.values());
}

export function HybridTextField({
    column,
    value,
    onChange,
    tableName,
}: HybridTextFieldProps) {
    const [mode, setMode] = useState<HybridMode>("selection");
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState<LookupOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);

    const textValue = value === undefined || value === null ? "" : String(value);

    useEffect(() => {
        let cancelled = false;

        async function loadLookupOptions() {
            if (mode !== "selection") {
                return;
            }

            try {
                setLoading(true);
                setLookupError(null);
                const response = await fetchForeignKeyLookup({
                    tableName,
                    columnName: column.name,
                    query,
                    limit: FOREIGN_KEY_REMOTE_DEFAULT_LIMIT,
                });

                if (cancelled) {
                    return;
                }

                setOptions(deduplicateByLabel(response));
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setLookupError(
                    error instanceof Error
                        ? error.message
                        : "No se pudieron cargar las opciones",
                );
                setOptions([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        const timeout = setTimeout(loadLookupOptions, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [mode, tableName, column.name, query]);

    const selectionOptions = useMemo(() => {
        if (!textValue || options.some((option) => option.label === textValue)) {
            return options;
        }

        return [{ value: textValue, label: textValue }, ...options];
    }, [options, textValue]);

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
                <div className="space-y-2">
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar valor existente..."
                        aria-label="Buscar valor existente"
                    />
                    <Select
                        value={textValue}
                        onValueChange={(nextLabel) => onChange(String(nextLabel))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un valor existente" />
                        </SelectTrigger>
                        <SelectContent>
                            {selectionOptions.map((option) => (
                                <SelectItem key={option.value} value={option.label}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {loading && (
                        <p className="text-xs text-muted-foreground">
                            Cargando opciones...
                        </p>
                    )}
                    {lookupError && (
                        <p className="text-xs text-destructive">{lookupError}</p>
                    )}
                    {!loading && !lookupError && selectionOptions.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                            Sin resultados para esta búsqueda.
                        </p>
                    )}
                </div>
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


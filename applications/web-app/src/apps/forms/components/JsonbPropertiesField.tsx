import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface JsonbPropertiesFieldProps {
    value: unknown;
    onChange: (value: Record<string, string>) => void;
}

interface PropertyEntry {
    id: number;
    key: string;
    value: string;
}

function parseJsonbValue(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (typeof value === "string" && value.trim() !== "") {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return {};
        }
    }

    return {};
}

function buildEntriesFromValue(value: unknown): PropertyEntry[] {
    const parsed = parseJsonbValue(value);
    return Object.entries(parsed).map(([key, entryValue], index) => ({
        id: index + 1,
        key,
        value: entryValue === undefined || entryValue === null ? "" : String(entryValue),
    }));
}

function buildJsonFromEntries(entries: PropertyEntry[]): Record<string, string> {
    return entries.reduce<Record<string, string>>((accumulator, entry) => {
        const normalizedKey = entry.key.trim();
        if (!normalizedKey) {
            return accumulator;
        }

        accumulator[normalizedKey] = entry.value;
        return accumulator;
    }, {});
}

function resolveNextDescriptionKey(entries: PropertyEntry[]): string {
    let index = entries.length + 1;

    while (entries.some((entry) => entry.key === `descripcion ${index}`)) {
        index += 1;
    }

    return `descripcion ${index}`;
}

export function JsonbPropertiesField({ value, onChange }: JsonbPropertiesFieldProps) {
    const entries = useMemo(() => buildEntriesFromValue(value), [value]);
    const hasEntries = entries.length > 0;

    const applyEntries = (nextEntries: PropertyEntry[]) => {
        onChange(buildJsonFromEntries(nextEntries));
    };

    const handleAddProperty = () => {
        const nextId = entries.reduce(
            (maxId, entry) => Math.max(maxId, entry.id),
            0,
        ) + 1;
        const nextEntry: PropertyEntry = {
            id: nextId,
            key: resolveNextDescriptionKey(entries),
            value: "",
        };
        applyEntries([...entries, nextEntry]);
    };

    const handleRemoveProperty = (entryId: number) => {
        applyEntries(entries.filter((entry) => entry.id !== entryId));
    };

    const handleEntryChange = (
        entryId: number,
        key: "key" | "value",
        nextValue: string,
    ) => {
        applyEntries(
            entries.map((entry) =>
                entry.id === entryId ? { ...entry, [key]: nextValue } : entry,
            ),
        );
    };

    return (
        <div className="space-y-3">
            {hasEntries ? (
                <div className="space-y-2">
                    {entries.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2">
                            <Input
                                value={entry.key}
                                onChange={(event) =>
                                    handleEntryChange(
                                        entry.id,
                                        "key",
                                        event.target.value,
                                    )
                                }
                                placeholder="Clave"
                                aria-label={`Clave propiedad ${entry.id}`}
                            />
                            <Input
                                value={entry.value}
                                onChange={(event) =>
                                    handleEntryChange(
                                        entry.id,
                                        "value",
                                        event.target.value,
                                    )
                                }
                                placeholder="Valor"
                                aria-label={`Valor propiedad ${entry.id}`}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleRemoveProperty(entry.id)}
                                aria-label={`Eliminar propiedad ${entry.id}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Sin propiedades definidas.
                </p>
            )}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddProperty}
            >
                <Plus className="h-4 w-4 mr-2" />
                Agregar propiedad
            </Button>
        </div>
    );
}

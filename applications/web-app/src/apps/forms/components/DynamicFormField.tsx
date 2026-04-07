import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import type { ColumnSchema, DataType } from "../schema";
import {
    FOREIGN_KEY_REMOTE_DEFAULT_LIMIT,
    FOREIGN_KEY_SEARCH_DEBOUNCE_MS,
    shouldUseAsyncForeignKey,
} from "../foreignKey";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/ui/utils";

interface DynamicFormFieldProps {
    column: ColumnSchema;
    value: any;
    onChange: (value: any) => void;
    onForeignKeyLookup?: (
        column: ColumnSchema,
        query: string,
        limit: number,
    ) => Promise<{ value: string; label: string }[]>;
    error?: string;
}

// Dictionary to translate technical types to human-friendly Spanish names
const getHumanFriendlyTypeName = (type: DataType): string => {
    const typeNames: Record<DataType, string> = {
        string: "Texto",
        varchar: "Texto",
        text: "Texto largo",
        integer: "Número entero",
        bigint: "Número grande",
        decimal: "Decimal",
        float: "Decimal",
        boolean: "Sí/No",
        date: "Fecha",
        datetime: "Fecha y hora",
        timestamp: "Fecha y hora",
        enum: "Selección",
        foreign_key: "Relación",
    };

    return typeNames[type] || type;
};

interface AsyncForeignKeyComboboxProps {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    onLookup?: (
        query: string,
        limit: number,
    ) => Promise<{ value: string; label: string }[]>;
    limit: number;
    hasError: boolean;
}

function AsyncForeignKeyCombobox({
    value,
    options,
    onChange,
    onLookup,
    limit,
    hasError,
}: AsyncForeignKeyComboboxProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [lookupOptions, setLookupOptions] = useState(options.slice(0, limit));
    const [loading, setLoading] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, FOREIGN_KEY_SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    useEffect(() => {
        let cancelled = false;

        async function resolveLookup() {
            if (!open) return;

            if (!onLookup) {
                setLookupError(null);
                setLookupOptions(options.slice(0, limit));
                return;
            }

            try {
                setLoading(true);
                setLookupError(null);
                const resolved = await onLookup(debouncedSearchQuery, limit);
                if (cancelled) return;
                setLookupOptions(resolved);
            } catch (error) {
                if (cancelled) return;
                setLookupError(
                    error instanceof Error
                        ? error.message
                        : "No se pudo cargar el lookup",
                );
                setLookupOptions([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        resolveLookup();

        return () => {
            cancelled = true;
        };
    }, [open, options, onLookup, debouncedSearchQuery, limit]);

    const selectedLabel = useMemo(() => {
        const selectedFromLive = lookupOptions.find(
            (option) => option.value === value,
        );
        if (selectedFromLive) {
            return selectedFromLive.label;
        }

        const selectedFromStatic = options.find((option) => option.value === value);
        return selectedFromStatic?.label;
    }, [lookupOptions, options, value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between",
                        hasError ? "border-destructive" : "",
                    )}
                >
                    <span className="truncate">
                        {selectedLabel ?? "Buscar y seleccionar..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Buscar..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList>
                        {loading && (
                            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Buscando opciones...
                            </div>
                        )}

                        {!loading && lookupError && (
                            <div className="px-3 py-3 text-sm text-destructive">
                                {lookupError}
                            </div>
                        )}

                        {!loading && !lookupError && lookupOptions.length === 0 && (
                            <div className="px-3 py-3 text-sm text-muted-foreground">
                                Sin resultados
                            </div>
                        )}

                        {!loading && !lookupError && lookupOptions.length > 0 && (
                            <CommandGroup>
                                {lookupOptions.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={`${option.label} ${option.value}`}
                                        onSelect={() => {
                                            onChange(option.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === option.value
                                                    ? "opacity-100"
                                                    : "opacity-0",
                                            )}
                                        />
                                        <span className="truncate">
                                            {option.label}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function DynamicFormField({
    column,
    value,
    onChange,
    onForeignKeyLookup,
    error,
}: DynamicFormFieldProps) {
    const isRequired = column.required && !column.nullable;
    const displayName = column.displayName || column.name;

    const renderField = () => {
        switch (column.type) {
            case "boolean":
                return (
                    <div className="flex items-center space-x-2 h-10">
                        <Switch
                            id={column.name}
                            checked={value || false}
                            onCheckedChange={onChange}
                        />
                        <Label htmlFor={column.name} className="cursor-pointer">
                            {value ? "Sí" : "No"}
                        </Label>
                    </div>
                );

            case "text":
                return (
                    <Textarea
                        id={column.name}
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={column.placeholder}
                        className={error ? "border-destructive" : ""}
                        rows={4}
                    />
                );

            case "date":
                return (
                    <Input
                        id={column.name}
                        type="date"
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        className={error ? "border-destructive" : ""}
                    />
                );

            case "datetime":
            case "timestamp":
                return (
                    <Input
                        id={column.name}
                        type="datetime-local"
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        className={error ? "border-destructive" : ""}
                    />
                );

            case "integer":
            case "bigint":
                return (
                    <Input
                        id={column.name}
                        type="number"
                        step="1"
                        value={value || ""}
                        onChange={(e) =>
                            onChange(
                                e.target.value ? parseInt(e.target.value) : "",
                            )
                        }
                        placeholder={column.placeholder}
                        className={error ? "border-destructive" : ""}
                    />
                );

            case "decimal":
            case "float":
                return (
                    <Input
                        id={column.name}
                        type="number"
                        step="0.01"
                        value={value || ""}
                        onChange={(e) =>
                            onChange(
                                e.target.value
                                    ? parseFloat(e.target.value)
                                    : "",
                            )
                        }
                        placeholder={column.placeholder}
                        className={error ? "border-destructive" : ""}
                    />
                );

            case "enum":
                return (
                    <Select value={value || ""} onValueChange={onChange}>
                        <SelectTrigger
                            className={error ? "border-destructive" : ""}
                        >
                            <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                        <SelectContent>
                            {column.enumValues?.map((enumValue) => (
                                <SelectItem key={enumValue} value={enumValue}>
                                    {enumValue}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case "foreign_key":
                if (shouldUseAsyncForeignKey(column)) {
                    return (
                        <AsyncForeignKeyCombobox
                            value={
                                value === undefined || value === null
                                    ? ""
                                    : String(value)
                            }
                            options={column.foreignKeyOptions ?? []}
                            onChange={(nextValue) => onChange(nextValue)}
                            onLookup={
                                onForeignKeyLookup
                                    ? (query, limit) =>
                                          onForeignKeyLookup(
                                              column,
                                              query,
                                              limit,
                                          )
                                    : undefined
                            }
                            limit={FOREIGN_KEY_REMOTE_DEFAULT_LIMIT}
                            hasError={Boolean(error)}
                        />
                    );
                }

                return (
                    <Select
                        value={
                            value === undefined || value === null
                                ? ""
                                : String(value)
                        }
                        onValueChange={onChange}
                    >
                        <SelectTrigger
                            className={error ? "border-destructive" : ""}
                        >
                            <SelectValue placeholder="Selecciona..." />
                        </SelectTrigger>
                        <SelectContent>
                            {column.foreignKeyOptions?.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            default: // string, varchar
                return (
                    <Input
                        id={column.name}
                        type="text"
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={column.placeholder}
                        maxLength={column.maxLength}
                        className={error ? "border-destructive" : ""}
                    />
                );
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={column.name}>
                    {displayName}
                    {isRequired && (
                        <span className="text-destructive ml-1">*</span>
                    )}
                </Label>
                <span className="text-xs text-muted-foreground">
                    {getHumanFriendlyTypeName(column.type)}
                </span>
            </div>
            {renderField()}
            {column.maxLength &&
                column.type !== "enum" &&
                column.type !== "foreign_key" && (
                    <p className="text-xs text-muted-foreground">
                        Máx. {column.maxLength} caracteres
                    </p>
                )}
            {column.hint && (
                <p className="text-xs text-muted-foreground">{column.hint}</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

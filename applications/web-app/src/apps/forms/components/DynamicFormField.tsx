import type { ColumnSchema, DataType } from "../schema";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";

interface DynamicFormFieldProps {
    column: ColumnSchema;
    value: any;
    onChange: (value: any) => void;
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

export function DynamicFormField({
    column,
    value,
    onChange,
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
                return (
                    <Select value={value || ""} onValueChange={onChange}>
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

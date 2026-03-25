import { Calendar, AlertCircle } from "lucide-react";

interface FormDatePickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
}

export function FormDatePicker({
    label,
    value,
    onChange,
    error,
    required = false,
}: FormDatePickerProps) {
    const hasError = !!error;

    return (
        <div className="space-y-1.5">
            <label className="block text-sm text-secondary-foreground">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </label>
            <div className="relative">
                <input
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`
            w-full px-4 py-2.5 pr-10 rounded-lg border bg-white
            transition-all duration-200
            text-secondary-foreground
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${
                hasError
                    ? "border-destructive focus:ring-destructive/20"
                    : "border-input focus:ring-ring/20"
            }
          `}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                {hasError && (
                    <AlertCircle className="absolute right-10 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive" />
                )}
            </div>
            {hasError && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

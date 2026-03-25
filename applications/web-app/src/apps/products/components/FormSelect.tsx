import React from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { AIBadge } from "./AIBadge";
import type { FieldAIStatus } from "../types";

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    error?: string;
    required?: boolean;
    options: { value: string; label: string }[];
    placeholder?: string;
    aiStatus?: FieldAIStatus;
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
    (
        {
            label,
            error,
            required = false,
            options,
            placeholder = "Seleccionar...",
            aiStatus,
            className = "",
            ...props
        },
        ref,
    ) => {
        const hasError = !!error;

        return (
            <div className="space-y-1.5">
                <label className="block text-sm text-secondary-foreground flex items-center gap-2">
                    <span>
                        {label}
                        {required && (
                            <span className="text-destructive ml-1">*</span>
                        )}
                    </span>
                    {aiStatus && (
                        <AIBadge
                            autocompletado={aiStatus.autocompletado}
                            requiereRevision={aiStatus.requiereRevision}
                            confianza={aiStatus.confianza}
                        />
                    )}
                </label>
                <div className="relative">
                    <select
                        ref={ref}
                        className={`
            w-full px-4 py-2.5 pr-10 rounded-lg border bg-white
            appearance-none cursor-pointer
            transition-all duration-200
            text-secondary-foreground
            focus:outline-none focus:ring-2 focus:ring-offset-1
            disabled:bg-muted disabled:cursor-not-allowed
            ${
                hasError
                    ? "border-destructive focus:ring-destructive/20"
                    : aiStatus?.requiereRevision
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-input focus:ring-ring/20"
            }
            ${className}
          `}
                        {...props}
                    >
                        <option value="">{placeholder}</option>
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    {hasError && (
                        <AlertCircle className="absolute right-10 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive" />
                    )}
                </div>
                {hasError && <p className="text-xs text-destructive">{error}</p>}
                {aiStatus?.requiereRevision && !hasError && (
                    <p className="text-xs text-destructive">
                        Este campo requiere revisión antes de enviar
                    </p>
                )}
            </div>
        );
    },
);

FormSelect.displayName = "FormSelect";

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
                <label className="block text-sm text-[#2F3339] flex items-center gap-2">
                    <span>
                        {label}
                        {required && (
                            <span className="text-[#C7664C] ml-1">*</span>
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
            text-[#2F3339]
            focus:outline-none focus:ring-2 focus:ring-offset-1
            disabled:bg-[#f3f4f6] disabled:cursor-not-allowed
            ${
                hasError
                    ? "border-[#d4183d] focus:ring-[#d4183d]/20"
                    : aiStatus?.requiereRevision
                      ? "border-[#C7664C] focus:ring-[#C7664C]/20"
                      : "border-[rgba(47,51,57,0.15)] focus:ring-[#B69559]/20"
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
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5c61] pointer-events-none" />
                    {hasError && (
                        <AlertCircle className="absolute right-10 top-1/2 -translate-y-1/2 w-5 h-5 text-[#d4183d]" />
                    )}
                </div>
                {hasError && <p className="text-xs text-[#d4183d]">{error}</p>}
                {aiStatus?.requiereRevision && !hasError && (
                    <p className="text-xs text-[#C7664C]">
                        Este campo requiere revisión antes de enviar
                    </p>
                )}
            </div>
        );
    },
);

FormSelect.displayName = "FormSelect";

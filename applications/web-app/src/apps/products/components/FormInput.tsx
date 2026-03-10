import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AIBadge } from "./AIBadge";
import type { FieldAIStatus } from "../types";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    required?: boolean;
    valid?: boolean;
    aiStatus?: FieldAIStatus;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
    (
        {
            label,
            error,
            required = false,
            valid = false,
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
                    <input
                        ref={ref}
                        className={`
            w-full px-4 py-2.5 rounded-lg border bg-white
            transition-all duration-200
            placeholder:text-[#9ca3af]
            focus:outline-none focus:ring-2 focus:ring-offset-1
            disabled:bg-[#f3f4f6] disabled:cursor-not-allowed
            ${
                hasError
                    ? "border-[#d4183d] focus:ring-[#d4183d]/20"
                    : aiStatus?.requiereRevision
                      ? "border-[#C7664C] focus:ring-[#C7664C]/20"
                      : valid
                        ? "border-[#10b981] focus:ring-[#10b981]/20"
                        : "border-[rgba(47,51,57,0.15)] focus:ring-[#B69559]/20"
            }
            ${className}
          `}
                        {...props}
                    />
                    {hasError && (
                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#d4183d]" />
                    )}
                    {valid && !hasError && !aiStatus?.requiereRevision && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981]" />
                    )}
                </div>
                {hasError && (
                    <p className="text-xs text-[#d4183d] flex items-center gap-1">
                        {error}
                    </p>
                )}
                {aiStatus?.requiereRevision && !hasError && (
                    <p className="text-xs text-[#C7664C]">
                        Este campo requiere revisión antes de enviar
                    </p>
                )}
            </div>
        );
    },
);

FormInput.displayName = "FormInput";

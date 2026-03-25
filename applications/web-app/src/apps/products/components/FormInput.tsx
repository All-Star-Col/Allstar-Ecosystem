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
                    <input
                        ref={ref}
                        className={`
            w-full px-4 py-2.5 rounded-lg border bg-white
            transition-all duration-200
            placeholder:text-placeholder
            focus:outline-none focus:ring-2 focus:ring-offset-1
            disabled:bg-muted disabled:cursor-not-allowed
            ${
                hasError
                    ? "border-destructive focus:ring-destructive/20"
                    : aiStatus?.requiereRevision
                      ? "border-destructive focus:ring-destructive/20"
                      : valid
                        ? "border-success focus:ring-success/20"
                        : "border-input focus:ring-ring/20"
            }
            ${className}
          `}
                        {...props}
                    />
                    {hasError && (
                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive" />
                    )}
                    {valid && !hasError && !aiStatus?.requiereRevision && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-success" />
                    )}
                </div>
                {hasError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                        {error}
                    </p>
                )}
                {aiStatus?.requiereRevision && !hasError && (
                    <p className="text-xs text-destructive">
                        Este campo requiere revisión antes de enviar
                    </p>
                )}
            </div>
        );
    },
);

FormInput.displayName = "FormInput";

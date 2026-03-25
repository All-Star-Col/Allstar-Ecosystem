import React from "react";

interface FormSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function FormSection({
    title,
    description,
    children,
    className = "",
}: FormSectionProps) {
    return (
        <div
            className={`bg-white rounded-lg p-6 shadow-sm border border-border ${className}`}
        >
            <div className="mb-5">
                <h3 className="text-foreground mb-1">{title}</h3>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

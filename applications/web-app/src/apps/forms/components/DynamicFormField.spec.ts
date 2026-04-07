import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicFormField } from "./DynamicFormField";
import type { ColumnSchema } from "../schema";

vi.mock("@/shared/ui/select", () => ({
    Select: ({
        value,
        onValueChange,
        children,
    }: {
        value?: string;
        onValueChange?: (value: string) => void;
        children: React.ReactNode;
    }) =>
        React.createElement(
            "select",
            {
                "aria-label": "foreign-key-select",
                value,
                onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                    onValueChange?.(event.target.value),
            },
            children,
        ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
        React.createElement(
            "option",
            { value: "" },
            placeholder ?? "Selecciona...",
        ),
    SelectContent: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    SelectItem: ({
        value,
        children,
    }: {
        value: string;
        children: React.ReactNode;
    }) => React.createElement("option", { value }, children),
}));

vi.mock("@/shared/ui/button", () => ({
    Button: ({
        children,
        ...props
    }: {
        children: React.ReactNode;
        [key: string]: unknown;
    }) => React.createElement("button", props, children),
}));

vi.mock("@/shared/ui/popover", () => ({
    Popover: ({
        open,
        onOpenChange,
        children,
    }: {
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
        children: React.ReactNode;
    }) => {
        React.useEffect(() => {
            if (!open) {
                onOpenChange?.(true);
            }
        }, [open, onOpenChange]);
        return React.createElement("div", null, children);
    },
    PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    PopoverContent: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", null, children),
}));

vi.mock("@/shared/ui/command", () => ({
    Command: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", null, children),
    CommandInput: ({
        value,
        onValueChange,
        placeholder,
    }: {
        value?: string;
        onValueChange?: (value: string) => void;
        placeholder?: string;
    }) =>
        React.createElement("input", {
            value,
            placeholder,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                onValueChange?.(event.target.value),
        }),
    CommandList: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", null, children),
    CommandGroup: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", null, children),
    CommandItem: ({
        children,
        onSelect,
        value,
    }: {
        children: React.ReactNode;
        onSelect?: (value: string) => void;
        value?: string;
    }) =>
        React.createElement(
            "button",
            {
                type: "button",
                onClick: () => onSelect?.(value ?? ""),
            },
            children,
        ),
}));

describe("DynamicFormField foreign key", () => {
    it("renders foreign keys as select and returns option value on selection", () => {
        const onChange = vi.fn();
        const foreignKeyColumn: ColumnSchema = {
            name: "id_base",
            displayName: "Base",
            type: "foreign_key",
            required: true,
            nullable: false,
            foreignKeyOptions: [
                { value: "1", label: "Base Norte" },
                { value: "2", label: "Base Sur" },
            ],
        };

        render(
            React.createElement(DynamicFormField, {
                column: foreignKeyColumn,
                value: "",
                onChange,
            }),
        );

        const selectTrigger = screen.getByRole("combobox", {
            name: "foreign-key-select",
        });
        const visibleOption = screen.getByRole("option", {
            name: "Base Norte",
        });
        expect(visibleOption).toBeInTheDocument();

        act(() => {
            fireEvent.change(selectTrigger, { target: { value: "1" } });
        });
        expect(onChange).toHaveBeenCalledWith("1");
    });

    it("renders async combobox states for large/remote lookups", async () => {
        const onChange = vi.fn();
        const onForeignKeyLookup = vi.fn().mockResolvedValue([]);

        const asyncForeignKeyColumn: ColumnSchema = {
            name: "id_base",
            displayName: "Base",
            type: "foreign_key",
            foreignKeyOptions: [],
        };

        render(
            React.createElement(DynamicFormField, {
                column: asyncForeignKeyColumn,
                value: "",
                onChange,
                onForeignKeyLookup,
            }),
        );

        expect(screen.getByText("Buscar y seleccionar...")).toBeInTheDocument();
        expect(screen.getByText("Buscando opciones...")).toBeInTheDocument();

        await waitFor(() => {
            expect(onForeignKeyLookup).toHaveBeenCalledWith(
                asyncForeignKeyColumn,
                "",
                30,
            );
        });
        expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    });

    it("shows lookup error state for async foreign key", async () => {
        const onChange = vi.fn();
        const onForeignKeyLookup = vi
            .fn()
            .mockRejectedValue(new Error("lookup failed"));

        const asyncForeignKeyColumn: ColumnSchema = {
            name: "id_base",
            displayName: "Base",
            type: "foreign_key",
            foreignKeyOptions: [],
        };

        render(
            React.createElement(DynamicFormField, {
                column: asyncForeignKeyColumn,
                value: "",
                onChange,
                onForeignKeyLookup,
            }),
        );

        await waitFor(() => {
            expect(screen.getByText("lookup failed")).toBeInTheDocument();
        });
    });

    it("selects async lookup label but emits id/value", async () => {
        const onChange = vi.fn();
        const onForeignKeyLookup = vi.fn().mockResolvedValue([
            { value: "77", label: "Base Premium" },
        ]);

        const asyncForeignKeyColumn: ColumnSchema = {
            name: "id_base",
            displayName: "Base",
            type: "foreign_key",
            foreignKeyOptions: [],
        };

        render(
            React.createElement(DynamicFormField, {
                column: asyncForeignKeyColumn,
                value: "",
                onChange,
                onForeignKeyLookup,
            }),
        );

        await waitFor(() => {
            expect(screen.getByText("Base Premium")).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(screen.getByText("Base Premium"));
        });
        expect(onChange).toHaveBeenCalledWith("77");
    });
});

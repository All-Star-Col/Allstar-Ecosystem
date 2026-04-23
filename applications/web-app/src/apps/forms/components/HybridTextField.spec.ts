import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnSchema } from "../schema";
import { HybridTextField } from "./HybridTextField";
import { fetchForeignKeyLookup } from "../api";

vi.mock("../api", () => ({
    fetchForeignKeyLookup: vi.fn(),
}));

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
                "aria-label": "hybrid-select",
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

const mockedFetchForeignKeyLookup = vi.mocked(fetchForeignKeyLookup);

const BASE_COLUMN: ColumnSchema = {
    name: "nombre",
    type: "varchar",
    placeholder: "Escribe un nombre",
};

describe("HybridTextField", () => {
    beforeEach(() => {
        mockedFetchForeignKeyLookup.mockReset();
        mockedFetchForeignKeyLookup.mockResolvedValue([
            { value: "1", label: "Lino" },
            { value: "2", label: "Algodón" },
        ]);
    });

    it("shows async selection mode controls", async () => {
        const onChange = vi.fn();

        render(
            React.createElement(HybridTextField, {
                column: BASE_COLUMN,
                value: "",
                onChange,
                tableName: "material",
            }),
        );

        expect(screen.getByText("Selección")).toBeInTheDocument();
        expect(screen.getByLabelText("Buscar valor existente")).toBeInTheDocument();

        await waitFor(() => {
            expect(mockedFetchForeignKeyLookup).toHaveBeenCalledWith({
                tableName: "material",
                columnName: "nombre",
                query: "",
                limit: 30,
            });
        }, { timeout: 1500 });
    });

    it("toggles to free text mode and renders a text input", () => {
        const onChange = vi.fn();

        render(
            React.createElement(HybridTextField, {
                column: BASE_COLUMN,
                value: "",
                onChange,
                tableName: "material",
            }),
        );

        fireEvent.click(screen.getByText("Texto libre"));
        expect(screen.getByPlaceholderText("Escribe un nombre")).toBeInTheDocument();
    });

    it("emits selected label string (not id) in selection mode", async () => {
        const onChange = vi.fn();

        render(
            React.createElement(HybridTextField, {
                column: BASE_COLUMN,
                value: "",
                onChange,
                tableName: "tela",
            }),
        );

        await waitFor(() => {
            expect(screen.getByRole("option", { name: "Lino" })).toBeInTheDocument();
        }, { timeout: 1500 });

        fireEvent.change(screen.getByLabelText("hybrid-select"), {
            target: { value: "Lino" },
        });

        expect(onChange).toHaveBeenCalledWith("Lino");
    });

    it("emits typed string in free text mode", () => {
        const onChange = vi.fn();

        render(
            React.createElement(HybridTextField, {
                column: {
                    ...BASE_COLUMN,
                    name: "referencia",
                    placeholder: "Escribe referencia",
                },
                value: "",
                onChange,
                tableName: "material",
            }),
        );

        fireEvent.click(screen.getByText("Texto libre"));
        fireEvent.change(screen.getByPlaceholderText("Escribe referencia"), {
            target: { value: "REF-2026" },
        });

        expect(onChange).toHaveBeenCalledWith("REF-2026");
    });
});

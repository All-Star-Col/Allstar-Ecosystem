import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnSchema } from "../schema";
import { HybridTextField } from "./HybridTextField";
import { fetchColumnValues } from "../api";

vi.mock("../api", () => ({
    fetchColumnValues: vi.fn(),
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

const mockedFetchColumnValues = vi.mocked(fetchColumnValues);

const BASE_COLUMN: ColumnSchema = {
    name: "nombre",
    type: "varchar",
    placeholder: "Escribe un nombre",
};

class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

describe("HybridTextField", () => {
    beforeEach(() => {
        globalThis.ResizeObserver = MockResizeObserver;
        mockedFetchColumnValues.mockReset();
        mockedFetchColumnValues.mockResolvedValue([
            { value: "1", label: "Lino" },
            { value: "2", label: "Algodon" },
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
        const combobox = screen.getByLabelText("Buscar valor existente");
        expect(combobox).toBeInTheDocument();

        fireEvent.click(combobox);

        await waitFor(
            () => {
                expect(mockedFetchColumnValues).toHaveBeenCalledWith({
                    tableName: "material",
                    columnName: "nombre",
                    query: "",
                    limit: 30,
                });
            },
            { timeout: 1500 },
        );
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

    it("emits selected value in selection mode", async () => {
        const onChange = vi.fn();

        render(
            React.createElement(HybridTextField, {
                column: BASE_COLUMN,
                value: "",
                onChange,
                tableName: "tela",
            }),
        );

        fireEvent.click(screen.getByLabelText("Buscar valor existente"));

        await waitFor(
            () => {
                expect(screen.getByRole("option", { name: "Lino" })).toBeInTheDocument();
            },
            { timeout: 1500 },
        );

        fireEvent.click(screen.getByRole("option", { name: "Lino" }));

        expect(onChange).toHaveBeenCalledWith("1");
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

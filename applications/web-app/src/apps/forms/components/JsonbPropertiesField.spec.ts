import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JsonbPropertiesField } from "./JsonbPropertiesField";

describe("JsonbPropertiesField", () => {
    it("adds properties and emits serialized JSON object", () => {
        const onChange = vi.fn();

        function Harness() {
            const [value, setValue] = React.useState<Record<string, string>>({});
            return React.createElement(JsonbPropertiesField, {
                value,
                onChange: (nextValue: Record<string, string>) => {
                    onChange(nextValue);
                    setValue(nextValue);
                },
            });
        }

        render(React.createElement(Harness));

        fireEvent.click(screen.getByText("Agregar propiedad"));
        expect(onChange).toHaveBeenLastCalledWith({
            "descripcion 1": "",
        });

        fireEvent.click(screen.getByText("Agregar propiedad"));
        expect(onChange).toHaveBeenLastCalledWith({
            "descripcion 1": "",
            "descripcion 2": "",
        });
    });

    it("removes a property and updates JSON output", () => {
        const onChange = vi.fn();

        render(
            React.createElement(JsonbPropertiesField, {
                value: {
                    "descripcion 1": "Algodón",
                    "descripcion 2": "Liviano",
                },
                onChange,
            }),
        );

        fireEvent.click(screen.getByLabelText("Eliminar propiedad 1"));

        expect(onChange).toHaveBeenLastCalledWith({
            "descripcion 2": "Liviano",
        });
    });

    it("emits empty object when all properties are removed", () => {
        const onChange = vi.fn();

        render(
            React.createElement(JsonbPropertiesField, {
                value: {
                    "descripcion 1": "Algodón",
                },
                onChange,
            }),
        );

        fireEvent.click(screen.getByLabelText("Eliminar propiedad 1"));
        expect(onChange).toHaveBeenLastCalledWith({});
    });
});

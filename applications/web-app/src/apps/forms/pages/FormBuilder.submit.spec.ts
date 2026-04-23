import { describe, expect, it } from "vitest";
import { buildSubmitData, normalizeSubmitValue } from "./formBuilderSubmit";
import type { ColumnSchema } from "../schema";

describe("FormBuilder submit payload", () => {
    it("sends foreign key id/value and never the visible label", () => {
        const visibleColumns: ColumnSchema[] = [
            {
                name: "id_base",
                type: "foreign_key",
                foreignKeyOptions: [
                    { value: "10", label: "Base Norte" },
                    { value: "11", label: "Base Sur" },
                ],
            },
            {
                name: "descripcion",
                type: "string",
            },
        ];

        const payloadData = buildSubmitData(visibleColumns, {
            id_base: "Base Norte",
            descripcion: "Pedido especial",
        });

        expect(payloadData).toEqual([
            { column: "id_base", value: "10" },
            { column: "descripcion", value: "Pedido especial" },
        ]);
        expect(payloadData[0]?.value).not.toBe("Base Norte");
    });

    it("keeps non-foreign-key values unchanged", () => {
        const regularColumn: ColumnSchema = {
            name: "cantidad",
            type: "integer",
        };

        expect(normalizeSubmitValue(regularColumn, 12)).toBe(12);
    });

    it("normalizes product SKU on submit to digits only", () => {
        const visibleColumns: ColumnSchema[] = [
            {
                name: "sku",
                type: "varchar",
            },
        ];

        const payloadData = buildSubmitData(
            visibleColumns,
            { sku: "1-001-002-0003-00004" },
            "productos",
        );

        expect(payloadData).toEqual([
            {
                column: "sku",
                value: "1001002000300004",
            },
        ]);
    });

    it("normalizes product SKU when table name includes schema", () => {
        const visibleColumns: ColumnSchema[] = [
            {
                name: "sku",
                type: "varchar",
            },
        ];

        const payloadData = buildSubmitData(
            visibleColumns,
            { sku: "1-001-002-0003-00004" },
            "data.productos",
        );

        expect(payloadData[0]?.value).toBe("1001002000300004");
    });
});

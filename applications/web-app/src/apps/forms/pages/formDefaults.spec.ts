import { describe, expect, it } from "vitest";
import { buildInitialFormData } from "./formDefaults";
import type { ColumnSchema } from "../schema";

describe("form defaults", () => {
    it("defaults date columns without explicit default to today (YYYY-MM-DD)", () => {
        const columns: ColumnSchema[] = [
            { name: "fecha_pedido", type: "date" },
            { name: "fecha_registro", type: "datetime" },
            { name: "timestamp_creado", type: "timestamp" },
        ];

        const result = buildInitialFormData(
            columns,
            new Date("2026-04-23T15:30:00.000Z"),
        );

        expect(result).toEqual({
            fecha_pedido: "2026-04-23",
        });
    });

    it("keeps explicit default values unchanged", () => {
        const columns: ColumnSchema[] = [
            {
                name: "fecha_inicio",
                type: "date",
                defaultValue: "2026-01-10",
            },
        ];

        expect(buildInitialFormData(columns, new Date("2026-04-23T00:00:00.000Z"))).toEqual({
            fecha_inicio: "2026-01-10",
        });
    });

    it("leaves fecha_entrega empty so it must be selected manually", () => {
        const columns: ColumnSchema[] = [
            { name: "fecha_entrega", type: "date" },
        ];

        expect(buildInitialFormData(columns, new Date("2026-04-23T00:00:00.000Z"))).toEqual({
        });
    });
});


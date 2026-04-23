import { describe, expect, it } from "vitest";
import { deriveProductFields, toProductSkuSubmit } from "./productDerivation";
import type { ColumnSchema } from "../schema";

const PRODUCT_COLUMNS: ColumnSchema[] = [
    {
        name: "id_base",
        type: "foreign_key",
        foreignKeyOptions: [{ value: "1", label: "Base Norte" }],
    },
    {
        name: "id_modelo",
        type: "foreign_key",
        foreignKeyOptions: [{ value: "2", label: "Modelo Slim" }],
    },
    {
        name: "id_referencia",
        type: "foreign_key",
        foreignKeyOptions: [{ value: "3", label: "Ref 3" }],
    },
    {
        name: "id_tela",
        type: "foreign_key",
        foreignKeyOptions: [{ value: "4", label: "Tela Lino" }],
    },
    { name: "sku", type: "varchar" },
    { name: "nombre", type: "varchar" },
];

describe("product field derivation", () => {
    it("derives SKU display and Nombre from selected base/modelo/referencia/tela", () => {
        const derived = deriveProductFields("productos", PRODUCT_COLUMNS, {
            id_base: "1",
            id_modelo: "2",
            id_referencia: "3",
            id_tela: "4",
        });

        expect(derived.sku).toBe("1-001-002-0003-00004");
        expect(derived.nombre).toBe("Base Norte Modelo Slim Ref 3 Tela Lino");
    });

    it("normalizes SKU submit value to digits only", () => {
        expect(toProductSkuSubmit("1-001-002-0003-00004")).toBe(
            "1001002000300004",
        );
    });

    it("uses selected foreign key labels for nombre when options are not preloaded", () => {
        const columnsWithoutOptions: ColumnSchema[] = PRODUCT_COLUMNS.map((column) =>
            column.type === "foreign_key"
                ? { ...column, foreignKeyOptions: undefined }
                : column,
        );

        const derived = deriveProductFields(
            "data.catalogo_producto",
            columnsWithoutOptions,
            {
                id_base: "1",
                id_modelo: "2",
                id_referencia: "3",
                id_tela: "4",
            },
            {
                id_base: "Base Norte",
                id_modelo: "Modelo Slim",
                id_referencia: "Ref 3",
                id_tela: "Tela Lino",
            },
        );

        expect(derived.sku).toBe("1-001-002-0003-00004");
        expect(derived.nombre).toBe("Base Norte Modelo Slim Ref 3 Tela Lino");
    });
});

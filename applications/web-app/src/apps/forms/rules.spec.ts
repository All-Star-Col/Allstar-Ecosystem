import { describe, expect, it } from "vitest";
import {
    isProductTable,
    shouldUseHybridTextField,
    isProductDerivedColumn,
    isProductDerivationContext,
    shouldUseProductModificationDateTimeField,
} from "./rules";

describe("forms rules", () => {
    it("detects product tables with schema-qualified names", () => {
        expect(isProductTable("productos")).toBe(true);
        expect(isProductTable("data.producto")).toBe(true);
        expect(isProductTable("workspace.productos")).toBe(true);
        expect(isProductTable('"data"."productos"')).toBe(true);
    });

    it("detects product derived columns with schema-qualified tables", () => {
        expect(isProductDerivedColumn("data.productos", "sku")).toBe(true);
        expect(isProductDerivedColumn("data.productos", "nombre")).toBe(true);
        expect(isProductDerivedColumn("data.productos", "estado")).toBe(false);
    });

    it("uses date-time input only for product modification date", () => {
        expect(
            shouldUseProductModificationDateTimeField(
                "data.productos",
                "fecha_modificacion",
            ),
        ).toBe(true);
        expect(
            shouldUseProductModificationDateTimeField(
                "data.productos",
                "fecha_creacion",
            ),
        ).toBe(false);
        expect(
            shouldUseProductModificationDateTimeField(
                "data.ordencompra",
                "fecha_modificacion",
            ),
        ).toBe(false);
    });

    it("enables hybrid text mode for material/tela with schema-qualified names", () => {
        expect(shouldUseHybridTextField("data.material", "nombre")).toBe(true);
        expect(shouldUseHybridTextField("data.tela", "referencia")).toBe(true);
        expect(shouldUseHybridTextField("data.ordenes", "nombre")).toBe(false);
    });

    it("detects product derivation context by column shape even with non-standard table name", () => {
        expect(
            isProductDerivationContext("data.catalogo_producto", [
                { name: "id_base" },
                { name: "id_modelo" },
                { name: "id_referencia" },
                { name: "id_tela" },
                { name: "sku" },
                { name: "nombre" },
            ]),
        ).toBe(true);
    });
});

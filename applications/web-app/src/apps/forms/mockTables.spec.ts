import { describe, expect, it } from "vitest";
import { categories, getCategoryById } from "./mockTables";

describe("forms category fixtures contract", () => {
    it("uses nombre as the canonical display field", () => {
        expect(categories.length).toBeGreaterThan(0);

        for (const category of categories) {
            expect(category.id).toBeTruthy();
            expect(category.nombre).toBeTruthy();
            expect("name" in category).toBe(false);
        }
    });

    it("returns contract-compliant category objects from getCategoryById", () => {
        const category = getCategoryById("ventas");

        expect(category).toBeDefined();
        expect(category?.id).toBe("ventas");
        expect(category?.nombre).toBe("Ventas");
        expect(category && "name" in category).toBe(false);
    });
});

import { describe, expect, it } from "vitest";
import { getCategoryBreadcrumbLabel } from "./categoryLabel";

describe("FormBuilder category breadcrumb label", () => {
    it("renders the category nombre when category exists", () => {
        const label = getCategoryBreadcrumbLabel({
            id: "ventas",
            nombre: "Ventas",
        });

        expect(label).toBe("Ventas");
    });

    it("uses fallback label when category is missing", () => {
        expect(getCategoryBreadcrumbLabel(undefined)).toBe("Categoría");
    });
});

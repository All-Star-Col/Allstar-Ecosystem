import { describe, expect, it } from "vitest";
import { mapAPIColumn, mapAPITableSummary } from "./schema";

describe("mapAPIColumn", () => {
    it("maps API foreign key metadata to foreign_key schema", () => {
        const mapped = mapAPIColumn({
            name: "id_base",
            type: "integer",
            required: true,
            foreign_key: true,
            foreign_key_options: [
                { value: "1", label: "Base Norte" },
                { value: "2", label: "Base Sur" },
            ],
        });

        expect(mapped.type).toBe("foreign_key");
        expect(mapped.displayName).toBe("Base");
        expect(mapped.foreignKeyOptions).toEqual([
            { value: "1", label: "Base Norte" },
            { value: "2", label: "Base Sur" },
        ]);
    });

    it("keeps enum behavior for non-foreign-key columns", () => {
        const mapped = mapAPIColumn({
            name: "status",
            type: "varchar",
            enum_values: ["draft", "approved"],
            foreign_key: false,
        });

        expect(mapped.type).toBe("enum");
        expect(mapped.enumValues).toEqual(["draft", "approved"]);
        expect(mapped.foreignKeyOptions).toBeUndefined();
    });

    it("supports foreign keys without prefetched options", () => {
        const mapped = mapAPIColumn({
            name: "id_cliente",
            type: "integer",
            foreign_key: true,
            foreign_key_options: null,
        });

        expect(mapped.type).toBe("foreign_key");
        expect(mapped.foreignKeyOptions).toBeUndefined();
    });
});

describe("mapAPITableSummary", () => {
    it("creates lightweight tables without hydrating columns payload", () => {
        const mapped = mapAPITableSummary({
            id: 1,
            name_sql: "productos",
            name_form: "Productos",
            category_id: 5,
            columns: [
                {
                    name: "id",
                    type: "integer",
                },
                {
                    name: "nombre",
                    type: "varchar",
                },
            ],
        });

        expect(mapped.columns).toEqual([]);
        expect(mapped.columnCount).toBe(2);
    });
});

import { describe, expect, it } from "vitest";
import {
    filterForeignKeyOptions,
    FOREIGN_KEY_INLINE_OPTIONS_LIMIT,
    shouldUseAsyncForeignKey,
} from "./foreignKey";

describe("foreign key helpers", () => {
    it("uses async mode when no options are prefetched", () => {
        expect(
            shouldUseAsyncForeignKey({
                name: "id_base",
                type: "foreign_key",
                foreignKeyOptions: [],
            }),
        ).toBe(true);
    });

    it("keeps simple mode for small prefetched lookups", () => {
        expect(
            shouldUseAsyncForeignKey({
                name: "id_base",
                type: "foreign_key",
                foreignKeyOptions: [{ value: "1", label: "Base A" }],
            }),
        ).toBe(false);
    });

    it("uses async mode for large prefetched lookups", () => {
        const options = Array.from(
            { length: FOREIGN_KEY_INLINE_OPTIONS_LIMIT + 1 },
            (_, index) => ({
                value: String(index + 1),
                label: `Base ${index + 1}`,
            }),
        );

        expect(
            shouldUseAsyncForeignKey({
                name: "id_base",
                type: "foreign_key",
                foreignKeyOptions: options,
            }),
        ).toBe(true);
    });

    it("filters and limits local options", () => {
        const options = [
            { value: "1", label: "Base Norte" },
            { value: "2", label: "Base Sur" },
            { value: "3", label: "Bodega Central" },
        ];

        expect(filterForeignKeyOptions(options, "base", 1)).toEqual([
            { value: "1", label: "Base Norte" },
        ]);
    });
});

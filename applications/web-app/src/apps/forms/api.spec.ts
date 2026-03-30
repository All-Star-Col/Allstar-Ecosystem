import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/auth/auth.service", () => ({
    getToken: vi.fn(),
}));

import {
    fetchCategories,
    fetchForeignKeyLookup,
    fetchTableByName,
    fetchTables,
    submitFormData,
} from "./api";
import { getToken } from "@/core/auth/auth.service";

const mockedGetToken = vi.mocked(getToken);

describe("forms api auth headers", () => {
    beforeEach(() => {
        mockedGetToken.mockReturnValue("token-123");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sends authorization and revalidation headers on categories fetch", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify([{ id: 1, nombre: "Test" }]), {
                status: 200,
                headers: {
                    ETag: "etag-1",
                    "Last-Modified": "yesterday",
                },
            }),
        );

        await fetchCategories({ etag: "etag-old", lastModified: "today" });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer token-123",
                    "If-None-Match": "etag-old",
                    "If-Modified-Since": "today",
                }),
            }),
        );
    });

    it("keeps 304 revalidation behavior for tables fetch", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(null, { status: 304 }),
        );

        const result = await fetchTables({
            etag: "etag-cached",
            lastModified: "cached-date",
        });

        expect(result.notModified).toBe(true);
        expect(result.data).toBeNull();
        expect(result.etag).toBe("etag-cached");
        expect(result.lastModified).toBe("cached-date");
    });

    it("sends authorization header on submit", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    status: "success",
                    correlation_id: "tb_1",
                }),
                { status: 200 },
            ),
        );

        await submitFormData({
            table_name: "orders",
            data: [{ column: "amount", value: 10 }],
        });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    Authorization: "Bearer token-123",
                }),
            }),
        );
    });

    it("fetches single table metadata by table name", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    id: 2,
                    name_sql: "productos",
                    name_form: "Productos",
                    category_id: 1,
                    columns: [],
                }),
                {
                    status: 200,
                    headers: {
                        ETag: "etag-detail",
                        "Last-Modified": "today",
                    },
                },
            ),
        );

        const result = await fetchTableByName("productos");

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining("/workspace/forms/tables/productos"),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer token-123",
                }),
            }),
        );
        expect(result.data?.name_sql).toBe("productos");
    });

    it("falls back to list endpoint when single table endpoint is unavailable", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 404,
                    statusText: "Not Found",
                }),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify([
                        {
                            id: 9,
                            name_sql: "ordenes",
                            name_form: "Ordenes",
                            category_id: 2,
                            columns: [],
                        },
                    ]),
                    { status: 200 },
                ),
            );

        const result = await fetchTableByName("ordenes");

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(result.data?.name_sql).toBe("ordenes");
    });

    it("falls back to list endpoint when single table endpoint fails with server error", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ detail: "boom" }), {
                    status: 500,
                    statusText: "Internal Server Error",
                }),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify([
                        {
                            id: 7,
                            name_sql: "producto",
                            name_form: "Producto",
                            category_id: 2,
                            columns: [{ name: "descripcion", type: "text" }],
                        },
                    ]),
                    { status: 200 },
                ),
            );

        const result = await fetchTableByName("producto");

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(result.data?.name_sql).toBe("producto");
        expect(result.data?.columns).toHaveLength(1);
    });

    it("supports foreign key remote lookup with query and limit", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 404,
                    statusText: "Not Found",
                }),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        options: [
                            { value: "1", label: "Base A" },
                            { value: "2", label: "Base B" },
                        ],
                    }),
                    { status: 200 },
                ),
            );

        const result = await fetchForeignKeyLookup({
            tableName: "productos",
            columnName: "id_base",
            query: "ba",
            limit: 20,
        });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        const firstCallUrl = fetchSpy.mock.calls[0]?.[0];
        const secondCallUrl = fetchSpy.mock.calls[1]?.[0];
        expect(String(firstCallUrl)).toContain(
            "/workspace/forms/lookups/productos/id_base",
        );
        expect(String(firstCallUrl)).toContain("q=ba");
        expect(String(firstCallUrl)).toContain("limit=20");
        expect(String(secondCallUrl)).toContain("table_name=productos");
        expect(String(secondCallUrl)).toContain("column_name=id_base");
        expect(result).toEqual([
            { value: "1", label: "Base A" },
            { value: "2", label: "Base B" },
        ]);
    });
});

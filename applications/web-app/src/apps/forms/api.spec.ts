import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/auth/auth.service", () => ({
    getToken: vi.fn(),
}));

import { fetchCategories, fetchTables, submitFormData } from "./api";
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
});

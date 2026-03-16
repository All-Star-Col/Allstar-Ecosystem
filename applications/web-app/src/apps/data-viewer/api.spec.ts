import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/auth/auth.service", () => ({
    getToken: vi.fn(),
}));

import { getToken } from "@/core/auth/auth.service";
import {
    exportDataViewerCsv,
    fetchDataViewerTables,
    queryDataViewer,
} from "./api";

const mockedGetToken = vi.mocked(getToken);

describe("data-viewer api", () => {
    beforeEach(() => {
        mockedGetToken.mockReturnValue("token-123");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sends auth and request id on tables endpoint", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify([]), {
                status: 200,
                headers: {
                    "X-Request-ID": "req-1",
                },
            }),
        );

        const result = await fetchDataViewerTables();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [, options] = fetchSpy.mock.calls[0];
        const headers = new Headers(options?.headers);

        expect(headers.get("Authorization")).toBe("Bearer token-123");
        expect(headers.get("X-Request-ID")).toBeTruthy();
        expect(result.requestId).toBe("req-1");
    });

    it("sends query payload to backend contract", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    rows: [{ id: 1 }],
                    total_count: 1,
                    limit: 100,
                    offset: 0,
                    has_more: false,
                }),
                {
                    status: 200,
                    headers: {
                        "X-Request-ID": "req-2",
                    },
                },
            ),
        );

        const payload = {
            table_id: "orders",
            columns: ["id"],
            include_total: false,
            limit: 100,
            offset: 0,
        };

        const response = await queryDataViewer(payload);

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe("POST");
        expect(options?.body).toBe(JSON.stringify(payload));
        expect(response.result.rows).toEqual([{ id: 1 }]);
        expect(response.requestId).toBe("req-2");
    });

    it("downloads csv export and parses filename from header", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("id,name\n1,ACME", {
                status: 200,
                headers: {
                    "Content-Disposition":
                        'attachment; filename="data_viewer_orders_2026.csv"',
                    "X-Request-ID": "req-3",
                },
            }),
        );

        const { filename, requestId } = await exportDataViewerCsv({
            table_id: "orders",
            columns: ["id", "name"],
            limit: 10000,
            offset: 0,
        });

        expect(filename).toBe("data_viewer_orders_2026.csv");
        expect(requestId).toBe("req-3");
    });

    it("maps backend validation errors with code and request_id", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    request_id: "req-err",
                    detail: "limit exceeded",
                    code: "LIMIT_EXCEEDED",
                }),
                {
                    status: 422,
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            ),
        );

        await expect(
            queryDataViewer({
                table_id: "orders",
                columns: ["id"],
                limit: 999,
                offset: 0,
            }),
        ).rejects.toMatchObject({
            status: 422,
            code: "LIMIT_EXCEEDED",
            requestId: "req-err",
            message: "limit exceeded",
        });
    });
});

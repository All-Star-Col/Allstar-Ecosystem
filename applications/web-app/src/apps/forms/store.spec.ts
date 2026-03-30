import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

vi.mock("./api", () => ({
    fetchCategories: vi.fn(),
    fetchTables: vi.fn(),
    fetchTableByName: vi.fn(),
}));

import { fetchCategories, fetchTableByName, fetchTables } from "./api";
import { TablesProvider, useTables } from "./store";

const mockedFetchCategories = vi.mocked(fetchCategories);
const mockedFetchTables = vi.mocked(fetchTables);
const mockedFetchTableByName = vi.mocked(fetchTableByName);

interface ProbeProps {
    onReady: (context: ReturnType<typeof useTables>) => void;
}

function Probe({ onReady }: ProbeProps) {
    const context = useTables();

    React.useEffect(() => {
        if (!context.loading) {
            onReady(context);
        }
    }, [context, onReady]);

    return null;
}

describe("forms store deferred metadata flow", () => {
    beforeEach(() => {
        localStorage.clear();
        mockedFetchCategories.mockReset();
        mockedFetchTables.mockReset();
        mockedFetchTableByName.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps initial table metadata lightweight", async () => {
        mockedFetchCategories.mockResolvedValue({
            data: [{ id: 1, nombre: "Catalogos" }],
            etag: null,
            lastModified: null,
            notModified: false,
        });
        mockedFetchTables.mockResolvedValue({
            data: [
                {
                    id: 1,
                    name_sql: "productos",
                    name_form: "Productos",
                    category_id: 1,
                    columns: [
                        {
                            name: "id_base",
                            type: "integer",
                            foreign_key: true,
                            foreign_key_options: [
                                { value: "1", label: "Base A" },
                                { value: "2", label: "Base B" },
                            ],
                        },
                    ],
                },
            ],
            etag: null,
            lastModified: null,
            notModified: false,
        });
        mockedFetchTableByName.mockResolvedValue({
            data: null,
            etag: null,
            lastModified: null,
            notModified: false,
        });

        let contextSnapshot: ReturnType<typeof useTables> | undefined;
        render(
            React.createElement(
                TablesProvider,
                null,
                React.createElement(Probe, {
                    onReady: (context) => {
                        contextSnapshot = context;
                    },
                }),
            ),
        );

        await waitFor(() => {
            expect(contextSnapshot?.loading).toBe(false);
        });

        expect(contextSnapshot?.tables[0]?.columns).toEqual([]);
        expect(contextSnapshot?.tables[0]?.columnCount).toBe(1);
    });

    it("loads detailed metadata only when opening a specific table", async () => {
        mockedFetchCategories.mockResolvedValue({
            data: [{ id: 1, nombre: "Catalogos" }],
            etag: null,
            lastModified: null,
            notModified: false,
        });
        mockedFetchTables.mockResolvedValue({
            data: [
                {
                    id: 1,
                    name_sql: "productos",
                    name_form: "Productos",
                    category_id: 1,
                    columns: [],
                },
            ],
            etag: null,
            lastModified: null,
            notModified: false,
        });
        mockedFetchTableByName.mockResolvedValue({
            data: {
                id: 1,
                name_sql: "productos",
                name_form: "Productos",
                category_id: 1,
                columns: [
                    {
                        name: "id_base",
                        type: "integer",
                        foreign_key: true,
                        foreign_key_options: [{ value: "1", label: "Base A" }],
                    },
                ],
            },
            etag: null,
            lastModified: null,
            notModified: false,
        });

        let contextSnapshot: ReturnType<typeof useTables> | undefined;
        render(
            React.createElement(
                TablesProvider,
                null,
                React.createElement(Probe, {
                    onReady: (context) => {
                        contextSnapshot = context;
                    },
                }),
            ),
        );

        await waitFor(() => {
            expect(contextSnapshot?.loading).toBe(false);
        });

        let detail:
            | Awaited<ReturnType<ReturnType<typeof useTables>["loadTableById"]>>
            | undefined;
        await act(async () => {
            detail = await contextSnapshot?.loadTableById("1");
        });
        expect(mockedFetchTableByName).toHaveBeenCalledWith("productos");
        expect(detail?.columns.length).toBe(1);
        expect(detail?.columns[0]?.type).toBe("foreign_key");
    });
});

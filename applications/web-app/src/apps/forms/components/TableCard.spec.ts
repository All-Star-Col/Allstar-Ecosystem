import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableCard } from "./TableCard";
import type { TableSchema } from "../schema";

describe("TableCard field count", () => {
    it("uses visibleColumnCount when available", () => {
        const table: TableSchema = {
            id: "1",
            name: "productos",
            displayName: "Productos",
            category: "catalogos",
            columnCount: 8,
            visibleColumnCount: 6,
            columns: [],
        };

        render(
            React.createElement(TableCard, {
                table,
                onClick: vi.fn(),
            }),
        );

        expect(screen.getByText("6 campos")).toBeInTheDocument();
    });

    it("falls back to filtering hidden id/timestamp when columns are present", () => {
        const table: TableSchema = {
            id: "2",
            name: "ordenes",
            displayName: "Órdenes",
            category: "operaciones",
            columns: [
                { name: "id", type: "integer" },
                { name: "timestamp", type: "timestamp" },
                { name: "fecha_pedido", type: "date" },
                { name: "estado", type: "boolean" },
            ],
        };

        render(
            React.createElement(TableCard, {
                table,
                onClick: vi.fn(),
            }),
        );

        expect(screen.getByText("2 campos")).toBeInTheDocument();
    });
});


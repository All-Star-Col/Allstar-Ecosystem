import { describe, expect, it } from "vitest";
import {
    buildRowChanges,
    canEditRow,
    getEditableColumns,
    getQueryColumnKeys,
    getTableEditDisabledReason,
} from "./editing";
import type { DataViewerTable } from "../types";

const baseTable: DataViewerTable = {
    table_id: "orders",
    table_name: "data.orders",
    display_name: "Orders",
    has_pk: true,
    stable_order_column: "id",
    default_order_column: "id",
    order_error_code: null,
    can_update: true,
    can_insert: false,
    can_delete: false,
    pk_columns: ["id"],
    columns: [
        {
            name: "id",
            type: "integer",
            nullable: false,
            visible: true,
            editable: false,
            required: false,
            max_length: null,
            enum_values: null,
            read_only_reason: "PRIMARY_KEY",
        },
        {
            name: "status",
            type: "text",
            nullable: false,
            visible: true,
            editable: true,
            required: true,
            max_length: 20,
            enum_values: null,
            read_only_reason: null,
        },
        {
            name: "is_priority",
            type: "boolean",
            nullable: false,
            visible: true,
            editable: true,
            required: false,
            max_length: null,
            enum_values: null,
            read_only_reason: null,
        },
    ],
};

describe("data-viewer editing helpers", () => {
    it("keeps table editable even with incomplete metadata (test mode)", () => {
        const tableWithMissingMetadata: DataViewerTable = {
            ...baseTable,
            columns: [
                {
                    ...baseTable.columns[0],
                    editable: undefined,
                },
            ],
        };

        expect(getTableEditDisabledReason(tableWithMissingMetadata)).toBeNull();
    });

    it("allows row edition when PK exists", () => {
        expect(canEditRow(baseTable, { id: 1, status: "OPEN" })).toMatchObject({
            allowed: true,
            pk: { id: 1 },
        });

        expect(canEditRow(baseTable, { status: "OPEN" })).toMatchObject(
            {
                allowed: false,
            },
        );
    });

    it("builds only changed editable fields in update payload", () => {
        const editableColumns = getEditableColumns(baseTable);
        const row = {
            id: 7,
            status: "OPEN",
            is_priority: false,
        };

        const changes = buildRowChanges({
            row,
            editableColumns,
            draftValues: {
                status: "CLOSED",
                is_priority: true,
            },
        });

        expect(changes).toEqual({
            status: "CLOSED",
            is_priority: true,
        });
    });

    it("does not include row_version in query columns", () => {
        const visibleColumns = ["id", "status"];

        expect(getQueryColumnKeys(baseTable, visibleColumns)).not.toContain("row_version");

        const nonEditableTable: DataViewerTable = {
            ...baseTable,
            can_update: false,
        };

        const selectedColumns = getQueryColumnKeys(nonEditableTable, visibleColumns);
        expect(selectedColumns).toEqual(visibleColumns);
        expect(selectedColumns).not.toContain("row_version");
    });
});

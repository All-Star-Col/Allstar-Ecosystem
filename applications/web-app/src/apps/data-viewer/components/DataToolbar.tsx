import { Download, RefreshCw, Eye, EyeOff } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Switch from "@radix-ui/react-switch";
import { Check } from "lucide-react";
import { humanizeColumnName } from "../data/columnUtils";
import type { DataViewerColumn } from "../types";

interface DataToolbarProps {
    onExportCSV: () => void;
    onRefresh: () => void;
    columns: DataViewerColumn[];
    visibleColumns: Set<string>;
    onToggleColumn: (columnId: string) => void;
    includeTotal: boolean;
    onIncludeTotalChange: (value: boolean) => void;
    disabled?: boolean;
}

export function DataToolbar({
    onExportCSV,
    onRefresh,
    columns,
    visibleColumns,
    onToggleColumn,
    includeTotal,
    onIncludeTotalChange,
    disabled = false,
}: DataToolbarProps) {
    return (
        <div className="flex items-center gap-3 flex-wrap justify-end">
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <span>Total</span>
                <Switch.Root
                    checked={includeTotal}
                    onCheckedChange={onIncludeTotalChange}
                    disabled={disabled}
                    className="w-10 h-5 bg-gray-300 rounded-full relative data-[state=checked]:bg-[#122337] outline-none"
                >
                    <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
            </label>

            <button
                onClick={onRefresh}
                disabled={disabled}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <RefreshCw className="w-4 h-4" />
                <span>Refrescar</span>
            </button>

            <button
                onClick={onExportCSV}
                disabled={disabled}
                className="flex items-center gap-2 px-4 py-2 bg-[#122337] text-white rounded-lg hover:bg-[#1a3351] transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4" />
                <span>Exportar CSV</span>
            </button>

            <Popover.Root>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Eye className="w-4 h-4" />
                        <span>Columnas</span>
                        <span className="text-xs text-gray-500">
                            ({visibleColumns.size}/{columns.length})
                        </span>
                    </button>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-64 max-h-96 overflow-y-auto z-50"
                        sideOffset={5}
                    >
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <h3 className="text-sm font-semibold">
                                    Mostrar/Ocultar Columnas
                                </h3>
                            </div>

                            {columns.map((column) => {
                                const isVisible = visibleColumns.has(column.name);
                                return (
                                    <label
                                        key={column.name}
                                        className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded"
                                    >
                                        <Checkbox.Root
                                            checked={isVisible}
                                            onCheckedChange={() =>
                                                onToggleColumn(column.name)
                                            }
                                            className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center data-[state=checked]:bg-[#122337] data-[state=checked]:border-[#122337]"
                                        >
                                            <Checkbox.Indicator>
                                                <Check className="w-3 h-3 text-white" />
                                            </Checkbox.Indicator>
                                        </Checkbox.Root>
                                        <span className="text-sm flex-1">
                                            {humanizeColumnName(column.name)}
                                        </span>
                                        {!isVisible && (
                                            <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    );
}

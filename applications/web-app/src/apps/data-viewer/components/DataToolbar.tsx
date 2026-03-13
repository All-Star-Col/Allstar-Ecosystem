import { Download, RefreshCw, Eye, EyeOff } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

interface DataToolbarProps {
  onExportCSV: () => void;
  onRefresh: () => void;
  columns: string[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnId: string) => void;
}

export function DataToolbar({
  onExportCSV,
  onRefresh,
  columns,
  visibleColumns,
  onToggleColumn,
}: DataToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Refrescar</span>
      </button>

      <button
        onClick={onExportCSV}
        className="flex items-center gap-2 px-4 py-2 bg-[#122337] text-white rounded-lg hover:bg-[#1a3351] transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        <span>Exportar CSV</span>
      </button>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
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
                <h3 className="text-sm font-semibold">Mostrar/Ocultar Columnas</h3>
              </div>

              {columns.map((columnId) => {
                const isVisible = visibleColumns.has(columnId);
                return (
                  <label
                    key={columnId}
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded"
                  >
                    <Checkbox.Root
                      checked={isVisible}
                      onCheckedChange={() => onToggleColumn(columnId)}
                      className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center data-[state=checked]:bg-[#122337] data-[state=checked]:border-[#122337]"
                    >
                      <Checkbox.Indicator>
                        <Check className="w-3 h-3 text-white" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <span className="text-sm flex-1">{columnId}</span>
                    {!isVisible && <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
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
import { Download, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
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
    disabled = false,
}: DataToolbarProps) {
    return (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
                variant="default"
                size="sm"
                className="rounded-full shadow-sm"
                onClick={onExportCSV}
                disabled={disabled}
            >
                <Download className="w-4 h-4" />
                <span>Exportar CSV</span>
            </Button>
        </div>
    );
}

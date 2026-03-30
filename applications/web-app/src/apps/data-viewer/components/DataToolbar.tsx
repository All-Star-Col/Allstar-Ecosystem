import { Download } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface DataToolbarProps {
    onExportCSV: () => void;
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

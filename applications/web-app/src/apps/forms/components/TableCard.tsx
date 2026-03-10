import type { TableSchema } from "../schema";
import { Badge } from "@/shared/ui/badge";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { Database } from "lucide-react";

interface TableCardProps {
    table: TableSchema;
    onClick: () => void;
}

export function TableCard({ table, onClick }: TableCardProps) {
    return (
        <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-accent group"
            onClick={onClick}
        >
            <CardHeader className="py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Database className="h-5 w-5 text-accent flex-shrink-0" />
                        <CardTitle className="text-lg truncate leading-none">
                            {table.displayName}
                        </CardTitle>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">
                        {table.columns.length} campos
                    </Badge>
                </div>
            </CardHeader>
        </Card>
    );
}

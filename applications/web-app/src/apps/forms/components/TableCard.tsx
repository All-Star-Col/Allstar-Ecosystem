import type { TableSchema } from "../schema";
import { Badge } from "@/shared/ui/badge";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";

interface TableCardProps {
    table: TableSchema;
    onClick: () => void;
}

export function TableCard({ table, onClick }: TableCardProps) {
    const fieldCount = table.columnCount ?? table.columns.length;

    return (
        <Card
            className="cursor-pointer transition-all bg-card/90 hover:bg-primary/5 hover:border-primary/40 hover:shadow-sm group border border-border/80"
            onClick={onClick}
        >
            <CardHeader className="py-4">
                <div className="flex flex-wrap items-start gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-3 pr-1">
                        <div className="min-w-0 space-y-1">
                            <CardTitle className="text-base font-semibold leading-snug text-foreground break-words">
                                {table.displayName}
                            </CardTitle>

                        </div>
                    </div>
                    <Badge
                        variant="secondary"
                        className="ml-auto shrink-0 whitespace-nowrap bg-info/15 text-info border border-info/30"
                    >
                        {fieldCount} campos
                    </Badge>
                </div>
            </CardHeader>
        </Card>
    );
}

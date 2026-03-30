import type { ColumnSchema } from "./schema";

export const FOREIGN_KEY_INLINE_OPTIONS_LIMIT = 50;
export const FOREIGN_KEY_REMOTE_DEFAULT_LIMIT = 30;
export const FOREIGN_KEY_SEARCH_DEBOUNCE_MS = 300;

export function shouldUseAsyncForeignKey(column: ColumnSchema): boolean {
    if (column.type !== "foreign_key") {
        return false;
    }

    const optionsCount = column.foreignKeyOptions?.length ?? 0;
    return optionsCount === 0 || optionsCount > FOREIGN_KEY_INLINE_OPTIONS_LIMIT;
}

export function filterForeignKeyOptions(
    options: { value: string; label: string }[],
    query: string,
    limit: number,
): { value: string; label: string }[] {
    const normalizedQuery = query.trim().toLowerCase();
    const safeLimit = Math.max(1, limit);

    if (!normalizedQuery) {
        return options.slice(0, safeLimit);
    }

    return options
        .filter((option) => {
            const label = option.label.toLowerCase();
            const value = option.value.toLowerCase();
            return (
                label.includes(normalizedQuery) ||
                value.includes(normalizedQuery)
            );
        })
        .slice(0, safeLimit);
}

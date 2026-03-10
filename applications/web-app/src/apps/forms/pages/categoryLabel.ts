import type { Category } from "../schema";

export const getCategoryBreadcrumbLabel = (category?: Category): string => {
    return category?.nombre || "Categoría";
};

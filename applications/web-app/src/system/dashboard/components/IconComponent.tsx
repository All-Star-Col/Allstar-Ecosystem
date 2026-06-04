import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, keyof typeof LucideIcons> = {
    box: "Box",
    users: "Users",
    database: "Database",
    dollar_sign: "DollarSign",
    file_text: "FileText",
    briefcase: "Briefcase",
    user_check: "UserCheck",
    trending_up: "TrendingUp",
    shopping_cart: "ShoppingCart",
    headphones: "Headphones",
    bar_chart_3: "BarChart3",
    settings: "Settings",
    calendar: "Calendar",
    check_square: "CheckSquare",
};

export const iconComponents: Record<string, LucideIcon> = Object.fromEntries(
    Object.entries(iconMap).map(([key, iconName]) => [
        key,
        (LucideIcons[iconName] || LucideIcons.Box) as LucideIcon,
    ]),
);

export const getIconComponent = (iconKey: string): LucideIcon => {
    const iconName = iconMap[iconKey] || "Box";

    return (LucideIcons[iconName as keyof typeof LucideIcons] ||
        LucideIcons.Box) as LucideIcon;
};

import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const getIconComponent = (iconKey: string): LucideIcon => {
    const iconMap: Record<string, keyof typeof LucideIcons> = {
        users: "Users",
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

    const iconName = iconMap[iconKey] || "Box";

    return (LucideIcons[iconName as keyof typeof LucideIcons] ||
        LucideIcons.Box) as LucideIcon;
};

import { lazy } from "react";
import type { AppModule } from "@/core/types";

export const DataViewerModule: AppModule = {
    name: "data-viewer",
    title: "Data Viewer",
    path: "/app/data-viewer",
    icon: "bar_chart_3",
    component: lazy(() => import("./App")),
};

import { lazy } from "react";
import type { AppModule } from "@/core/types";

export const FormsModule: AppModule = {
    name: "forms",
    title: "Forms",
    path: "/app/forms",
    component: lazy(() => import("./App")),
};

import { lazy } from "react";
import type { AppModule } from "@/core/types";

export const ProductsModule: AppModule = {
    name: "Products",
    title: "Products",
    path: "/app/products",
    component: lazy(() => import("./App")),
};

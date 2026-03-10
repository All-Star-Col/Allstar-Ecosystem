import type { ComponentType, LazyExoticComponent } from "react";

export type AppModule = {
    name: string;
    title: string;
    path: string;
    icon?: string;
    component: LazyExoticComponent<ComponentType>;
};

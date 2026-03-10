import type { AppModule } from "./types";
import { FormsModule } from "@/apps/forms/module.config";
import { ProductsModule } from "@/apps/products/module.config";

export const modules: AppModule[] = [FormsModule, ProductsModule];

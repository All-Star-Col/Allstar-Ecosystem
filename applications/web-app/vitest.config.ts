import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@src": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        include: [
            "src/apps/forms/**/*.spec.ts",
            "src/apps/data-viewer/**/*.spec.ts",
            "src/test/**/*.spec.tsx",
        ],
        environment: "jsdom",
        globals: true,
    },
});

const configuredApiServer = String(import.meta.env.VITE_API_SERVER ?? "").trim();
const productionApiServer = "https://api-vm.tail6cef8e.ts.net/api/v1";

function resolveApiServer() {
    const isBrowser = typeof window !== "undefined";
    const hostname = isBrowser ? window.location.hostname : "";
    const isLocalFrontend =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".local");
    const isMissing =
        !configuredApiServer ||
        configuredApiServer === "undefined" ||
        configuredApiServer === "null";
    const pointsToLocalhost =
        configuredApiServer.includes("localhost") ||
        configuredApiServer.includes("127.0.0.1");

    if (isMissing || (!isLocalFrontend && pointsToLocalhost)) {
        return productionApiServer;
    }

    return configuredApiServer.replace(/\/+$/, "");
}

export const API_SERVER = resolveApiServer();

import { createContext } from "react";

export type CarpentryToastType = "success" | "error" | "warning" | "info";

export type CarpentryToastContextValue = {
    showToast: (message: string, type?: CarpentryToastType) => void;
};

export const ToastContext = createContext<CarpentryToastContextValue>({
    showToast: () => undefined,
});

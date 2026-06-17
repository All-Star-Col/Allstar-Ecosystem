import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import QuickLoading from "@/shared/components/QuickLoading";
import { clearToken, getToken, verifyToken } from "./auth.service";

export default function RequireAuth() {
    const hasToken = getToken() !== null;
    const [authorized, setAuthorized] = useState<
        "checking" | "confirmed" | "failed"
    >(hasToken ? "checking" : "failed");

    useEffect(() => {
        if (!hasToken) return;
        verifyToken().then((result) => {
            if (result.ok) {
                setAuthorized("confirmed");
                return;
            }

            if (result.reason === "unauthorized") {
                clearToken(); // solo aquí borras sesión
                setAuthorized("failed");
                return;
            }

            // network/server: no borres token
            setAuthorized("confirmed");
        });
    }, [hasToken]);

    if (authorized === "checking") {
        return <QuickLoading />;
    }

    if (authorized === "failed") {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

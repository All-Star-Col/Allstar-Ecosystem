import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "./auth.service";

export default function RequireGuest() {
    return isAuthenticated() ? (
        <Navigate to="/dashboard" replace />
    ) : (
        <Outlet />
    );
}


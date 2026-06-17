import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { modules } from "./modules";
import QuickLoading from "@/shared/components/QuickLoading";
import { isAuthenticated } from "./auth/auth.service";
import RequireAuth from "./auth/RequireAuth";
import RequireGuest from "./auth/RequireGuest";
import AppLayout from "./layout/AppLayout";
import MinimalLayout from "./layout/MinimalLayout";

const Login = lazy(() => import("@/system/login/Login"));
const Dashboard = lazy(() => import("@/system/dashboard/Dashboard"));
const Profile = lazy(() => import("@/system/profile/Profile"));
const NotFound = lazy(() => import("@/shared/components/NotFound"));

function RootRedirect() {
    return isAuthenticated() ? (
        <Navigate to="/dashboard" replace />
    ) : (
        <Navigate to="/login" replace />
    );
}

export function AppRoutes() {
    return (
        <Suspense fallback={<QuickLoading />}>
            <Routes>
                <Route path="/" element={<RootRedirect />} />

                <Route element={<MinimalLayout />}>
                    <Route element={<RequireGuest />}>
                        <Route path="/login" element={<Login />} />
                    </Route>
                </Route>

                <Route element={<RequireAuth />}>
                    <Route element={<AppLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/dashboard/profile" element={<Profile />} />
                        <Route
                            path="/app"
                            element={<Navigate to="/dashboard" replace />}
                        />
                        {modules.map((module) => (
                            <Route
                                key={module.name}
                                path={`${module.path}/*`}
                                element={<module.component />}
                            />
                        ))}
                        <Route path="/loading" element={<QuickLoading />} />
                    </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
            </Routes>
        </Suspense>
    );
}

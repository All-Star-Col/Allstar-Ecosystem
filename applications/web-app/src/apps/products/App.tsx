import {Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import NewRegistrationPage from "./pages/NewRegistrationPage";

export default function ProductRegistrationModuleApp() {
    return (
        <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="new" element={<NewRegistrationPage />} />
        </Routes>
    );
}

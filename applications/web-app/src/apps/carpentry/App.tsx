import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import ShellLayout from "./components/ShellLayout.jsx";
import Toast from "./components/Toast.jsx";
import { api } from "./api/client";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProyectosPage from "./pages/ProyectosPage.jsx";
import LotesPage from "./pages/LotesPage.jsx";
import BomPage from "./pages/BomPage.jsx";
import InventarioPage from "./pages/InventarioPage.jsx";
import ProduccionPage from "./pages/ProduccionPage.jsx";
import RecursosPage from "./pages/RecursosPage.jsx";
import ReportesPage from "./pages/ReportesPage.jsx";
import CatalogoMaterialesPage from "./pages/CatalogoMaterialesPage.jsx";
import { ToastContext, type CarpentryToastType } from "./toast-context";
import "./styles.css";

type CarpentryToastState = {
    message: string;
    type: CarpentryToastType;
} | null;

export default function CarpentryApp() {
  const [toast, setToast] = useState<CarpentryToastState>(null);

  const value = useMemo(
    () => ({
      showToast: (message: string, type: CarpentryToastType = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2600);
      },
    }),
    []
  );

  useEffect(() => {
    api
      .ping()
      .then(() => {
        if (import.meta.env.DEV) {
          console.info("[carpentry] module mounted and ping ok");
        }
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.error("[carpentry] ping failed", error);
        }
      });
  }, []);

  return (
    <div className="carpentry-app">
      <ToastContext.Provider value={value}>
        <AppErrorBoundary>
          <ShellLayout>
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="proyectos" element={<ProyectosPage />} />
              <Route path="lotes" element={<LotesPage />} />
              <Route path="bom" element={<BomPage />} />
              <Route path="inventario" element={<InventarioPage />} />
              <Route path="produccion" element={<ProduccionPage />} />
              <Route path="recursos" element={<RecursosPage />} />
              <Route path="catalogo" element={<CatalogoMaterialesPage />} />
              <Route path="reportes" element={<ReportesPage />} />
              <Route path="*" element={<Navigate to="." replace />} />
            </Routes>
          </ShellLayout>
        </AppErrorBoundary>
        <Toast toast={toast} />
      </ToastContext.Provider>
    </div>
  );
}

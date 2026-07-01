import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import ShellLayout from "./components/ShellLayout.jsx";
import Toast from "./components/Toast.jsx";
import { api } from "./api/client";
import { ToastContext, type CarpentryToastType } from "./toast-context";
import "./styles.css";

type CarpentryToastState = {
    message: string;
    type: CarpentryToastType;
} | null;

const ProyectosPage = lazy(() => import("./pages/ProyectosPage.jsx"));
const LotesPage = lazy(() => import("./pages/LotesPage.jsx"));
const BomPage = lazy(() => import("./pages/BomPage.jsx"));
const DocumentosPage = lazy(() => import("./pages/DocumentosPage.jsx"));
const InventarioPage = lazy(() => import("./pages/InventarioPage.jsx"));
const RecursosPage = lazy(() => import("./pages/RecursosPage.jsx"));
const CatalogoMaterialesPage = lazy(() => import("./pages/CatalogoMaterialesPage.jsx"));

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
    if (!import.meta.env.DEV) return;

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
            <Suspense fallback={<div className="panel">Cargando módulo...</div>}>
              <Routes>
                <Route index element={<Navigate to="proyectos" replace />} />
                <Route path="proyectos" element={<ProyectosPage />} />
                <Route path="lotes" element={<LotesPage />} />
                <Route path="bom" element={<BomPage />} />
                <Route path="documentos" element={<DocumentosPage />} />
                <Route path="inventario" element={<InventarioPage />} />
                <Route path="recursos" element={<RecursosPage />} />
                <Route path="catalogo" element={<CatalogoMaterialesPage />} />
                <Route path="*" element={<Navigate to="." replace />} />
              </Routes>
            </Suspense>
          </ShellLayout>
        </AppErrorBoundary>
        <Toast toast={toast} />
      </ToastContext.Provider>
    </div>
  );
}

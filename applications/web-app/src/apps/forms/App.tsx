import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/shared/ui/sonner";
import { TablesProvider } from "./store";
import TableSelection from "./pages/TableSelection";
import FormBuilder from "./pages/FormBuilder";
import NotFound from "@/shared/components/NotFound";

export default function FormsApp() {
    return (
        <TablesProvider>
            <Routes>
                <Route index element={<TableSelection />} />
                <Route path=":tableId" element={<FormBuilder />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster position="top-right" richColors closeButton />
        </TablesProvider>
    );
}

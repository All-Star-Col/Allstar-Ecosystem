import { useNavigate } from "react-router-dom";
import { DataViewerProModule } from "./components/DataViewerProModule";
import { mockTables } from "./data/mockData";

export default function DataViewerApp() {
    const navigate = useNavigate();

    return (
        <div className="h-screen w-full bg-[#f6f5f0]">
            <DataViewerProModule
                tables={mockTables}
                initialTableName={mockTables[0]?.name}
                onBack={() => navigate("/dashboard")}
                title="Data Viewer Pro"
                subtitle="Explorador de tablas"
            />
        </div>
    );
}

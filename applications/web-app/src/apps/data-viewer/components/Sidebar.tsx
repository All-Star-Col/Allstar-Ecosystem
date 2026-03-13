import { Search, Database, ArrowLeft } from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  tables: { name: string; displayName: string }[];
  title?: string;
  subtitle?: string;
  activeTable: string;
  onTableSelect: (tableName: string) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function Sidebar({
  tables,
  title = "Data Viewer Pro",
  subtitle = "Gestión de Datos",
  activeTable,
  onTableSelect,
  onBack,
  showBackButton = true,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    window.history.back();
  };

  const filteredTables = tables.filter((table) =>
    table.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-72 h-full min-h-0 bg-[#2f3339] text-white flex flex-col">
      {/* Return Button */}
      {showBackButton && (
        <button
          className="flex items-center gap-3 px-6 py-4 bg-[#122337] hover:bg-[#1a3351] transition-colors"
          onClick={handleBack}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Volver al Dashboard</span>
        </button>
      )}

      {/* Logo / Title */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-[#b69559]" />
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-white/60">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar tablas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#b69559] focus:border-transparent"
          />
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-1">
          {filteredTables.map((table) => (
            <button
              key={table.name}
              onClick={() => onTableSelect(table.name)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                activeTable === table.name
                  ? "bg-[#122337] text-white shadow-lg"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{table.displayName}</span>
                <span className="text-xs text-white/40">{table.name}</span>
              </div>
            </button>
          ))}
        </div>

        {filteredTables.length === 0 && (
          <div className="text-center py-8 text-white/40 text-sm">
            No se encontraron tablas
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs text-white/40">
          {tables.length} {tables.length === 1 ? "tabla" : "tablas"} disponibles
        </p>
      </div>
    </div>
  );
}

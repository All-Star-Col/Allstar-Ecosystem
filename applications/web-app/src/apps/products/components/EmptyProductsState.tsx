import { PackageX } from "lucide-react";

export function EmptyProductsState() {
    return (
        <div className="bg-white rounded-lg p-8 shadow-sm border-2 border-dashed border-[rgba(47,51,57,0.2)] text-center">
            <PackageX className="w-16 h-16 mx-auto mb-4 text-[#5a5c61]" />
            <h4 className="text-[#2F3339] mb-2">No hay productos agregados</h4>
            <p className="text-sm text-[#5a5c61]">
                Debes agregar al menos un producto antes de enviar a producción.
            </p>
        </div>
    );
}

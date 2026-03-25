import { PackageX } from "lucide-react";

export function EmptyProductsState() {
    return (
        <div className="bg-white rounded-lg p-8 shadow-sm border-2 border-dashed border-input text-center">
            <PackageX className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h4 className="text-secondary-foreground mb-2">No hay productos agregados</h4>
            <p className="text-sm text-muted-foreground">
                Debes agregar al menos un producto antes de enviar a producción.
            </p>
        </div>
    );
}

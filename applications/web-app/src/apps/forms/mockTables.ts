interface MockCategory {
    id: string;
    nombre: string;
}

export const categories: MockCategory[] = [
    { id: "ventas", nombre: "Ventas" },
    { id: "compras", nombre: "Compras" },
    { id: "inventario", nombre: "Inventario" },
];

export function getCategoryById(id: string): MockCategory | undefined {
    return categories.find((category) => category.id === id);
}

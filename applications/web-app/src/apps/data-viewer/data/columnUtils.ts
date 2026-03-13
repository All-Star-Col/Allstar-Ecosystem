const columnNameMappings: Record<string, string> = {
  id: "ID",
  user_name: "Nombre",
  email: "Correo",
  user_auth_provider_id: "Proveedor Auth",
  is_verified: "Verificado",
  account_status: "Estado de Cuenta",
  created_at: "Fecha Creación",
  last_login: "Último Acceso",
  subscription_tier: "Plan",
  total_spent: "Total Gastado",
  order_id: "ID Pedido",
  customer_id: "ID Cliente",
  order_total_amount: "Monto Total",
  order_status: "Estado",
  payment_method: "Método de Pago",
  is_gift: "Es Regalo",
  shipped_at: "Fecha Envío",
  tracking_number: "Nº Seguimiento",
  discount_applied: "Descuento (%)",
  product_id: "ID Producto",
  product_name: "Nombre Producto",
  category: "Categoría",
  stock_quantity: "Stock",
  unit_price: "Precio Unitario",
  warehouse_location: "Almacén",
  is_active: "Activo",
  reorder_threshold: "Umbral Reorden",
  last_restocked: "Última Reposición",
  supplier_id: "ID Proveedor",
  brand: "Marca",
  sku: "SKU",
  retail_price: "Precio Venta",
  cost_price: "Precio Coste",
  is_featured: "Destacado",
  rating_average: "Valoración",
  review_count: "Nº Reseñas",
  created_date: "Fecha Creación",
  full_name: "Nombre Completo",
  contact_email: "Email",
  phone_number: "Teléfono",
  city: "Ciudad",
  customer_segment: "Segmento",
  lifetime_value: "Valor Vida",
  is_subscriber: "Suscriptor",
  registration_date: "Fecha Registro",
  last_purchase_date: "Última Compra",
};

export const humanizeColumnName = (columnName: string): string => {
  return (
    columnNameMappings[columnName] ||
    columnName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
};

export const getColumnType = (value: unknown): string => {
  if (value === null || value === undefined) return "text";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    if (Number.isInteger(value) && value < 1000000) return "number";
    return "currency";
  }
  if (typeof value === "string") {
    if (value.match(/^\d{4}-\d{2}-\d{2}T/)) return "date";
    if (value.includes("@")) return "email";
  }
  return "text";
};

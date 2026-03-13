import type { DataViewerTable } from "../types";

// Mock data for Data Viewer Pro

// Generate realistic mock data
const generateUsers = (count: number) => {
  const names = ["Ana García", "Carlos López", "María Rodríguez", "Juan Martínez", "Laura Sánchez", "Pedro Fernández", "Isabel Torres", "Miguel Ruiz", "Carmen Díaz", "Francisco Moreno"];
  const providers = ["google", "facebook", "email", "github"];
  const statuses = ["active", "inactive", "pending"];
  
  return Array.from({ length: count }, (_, i) => ({
    id: 1000 + i,
    user_name: names[i % names.length],
    email: `user${i}@empresa.com`,
    user_auth_provider_id: providers[Math.floor(Math.random() * providers.length)],
    is_verified: Math.random() > 0.3,
    account_status: statuses[Math.floor(Math.random() * statuses.length)],
    created_at: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString(),
    last_login: new Date(2026, 2, Math.floor(Math.random() * 13)).toISOString(),
    subscription_tier: ["free", "pro", "enterprise"][Math.floor(Math.random() * 3)],
    total_spent: Math.floor(Math.random() * 5000) + 100,
  }));
};

const generateOrders = (count: number) => {
  const statuses = ["pending", "processing", "completed", "cancelled"];
  const paymentMethods = ["credit_card", "paypal", "bank_transfer", "crypto"];
  
  return Array.from({ length: count }, (_, i) => ({
    order_id: `ORD-${10000 + i}`,
    customer_id: 1000 + Math.floor(Math.random() * 100),
    order_total_amount: parseFloat((Math.random() * 1000 + 50).toFixed(2)),
    order_status: statuses[Math.floor(Math.random() * statuses.length)],
    payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
    is_gift: Math.random() > 0.8,
    created_at: new Date(2026, Math.floor(Math.random() * 3), Math.floor(Math.random() * 13)).toISOString(),
    shipped_at: Math.random() > 0.5 ? new Date(2026, Math.floor(Math.random() * 3), Math.floor(Math.random() * 13)).toISOString() : null,
    tracking_number: Math.random() > 0.4 ? `TRK${Math.random().toString(36).substring(7).toUpperCase()}` : null,
    discount_applied: Math.floor(Math.random() * 30),
  }));
};

const generateInventory = (count: number) => {
  const categories = ["Electronics", "Clothing", "Food", "Books", "Toys", "Furniture"];
  const warehouses = ["MAD-01", "BCN-02", "VAL-03", "SEV-04"];
  
  return Array.from({ length: count }, (_, i) => ({
    product_id: `PRD-${5000 + i}`,
    product_name: `Producto ${i + 1}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    stock_quantity: Math.floor(Math.random() * 1000),
    unit_price: parseFloat((Math.random() * 200 + 10).toFixed(2)),
    warehouse_location: warehouses[Math.floor(Math.random() * warehouses.length)],
    is_active: Math.random() > 0.2,
    reorder_threshold: Math.floor(Math.random() * 50) + 10,
    last_restocked: new Date(2026, Math.floor(Math.random() * 3), Math.floor(Math.random() * 13)).toISOString(),
    supplier_id: Math.floor(Math.random() * 20) + 1,
  }));
};

const generateProducts = (count: number) => {
  const brands = ["TechPro", "StyleMax", "HomeBest", "WorkFlow", "LifePlus"];
  
  return Array.from({ length: count }, (_, i) => ({
    id: 2000 + i,
    product_name: `Producto Premium ${i + 1}`,
    brand: brands[Math.floor(Math.random() * brands.length)],
    sku: `SKU-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    retail_price: parseFloat((Math.random() * 500 + 20).toFixed(2)),
    cost_price: parseFloat((Math.random() * 300 + 10).toFixed(2)),
    is_featured: Math.random() > 0.7,
    rating_average: parseFloat((Math.random() * 2 + 3).toFixed(1)),
    review_count: Math.floor(Math.random() * 500),
    created_date: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString(),
  }));
};

const generateCustomers = (count: number) => {
  const cities = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Málaga"];
  const segments = ["VIP", "Regular", "New", "Inactive"];
  
  return Array.from({ length: count }, (_, i) => ({
    customer_id: 3000 + i,
    full_name: `Cliente ${i + 1}`,
    contact_email: `cliente${i}@correo.com`,
    phone_number: `+34 ${Math.floor(Math.random() * 900000000 + 100000000)}`,
    city: cities[Math.floor(Math.random() * cities.length)],
    customer_segment: segments[Math.floor(Math.random() * segments.length)],
    lifetime_value: parseFloat((Math.random() * 10000 + 100).toFixed(2)),
    is_subscriber: Math.random() > 0.5,
    registration_date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString(),
    last_purchase_date: new Date(2026, Math.floor(Math.random() * 3), Math.floor(Math.random() * 13)).toISOString(),
  }));
};

export const mockTables: DataViewerTable[] = [
  {
    name: "users",
    displayName: "Usuarios",
    data: generateUsers(1500),
  },
  {
    name: "orders",
    displayName: "Pedidos",
    data: generateOrders(2000),
  },
  {
    name: "inventory",
    displayName: "Inventario",
    data: generateInventory(800),
  },
  {
    name: "products",
    displayName: "Productos",
    data: generateProducts(500),
  },
  {
    name: "customers",
    displayName: "Clientes",
    data: generateCustomers(1200),
  },
];

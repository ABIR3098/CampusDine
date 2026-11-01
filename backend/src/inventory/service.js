// All inventory database work lives here. Every stock change happens inside a transaction with the item row
// locked (SELECT ... FOR UPDATE) and always writes a row to inventory_stock_history.

const { canTransition, stockLevel } = require("./rules");

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const itemView = (r) => ({
  id: r.id, name: r.name, nameBn: r.name_bn, category: r.category, unit: r.unit,
  currentStock: Number(r.current_stock), minStock: Number(r.min_stock),
  level: stockLevel(r.current_stock, r.min_stock), updatedAt: r.updated_at,
});


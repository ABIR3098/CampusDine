// All inventory database work lives here. Every stock change happens inside a transaction with the item row
// locked (SELECT ... FOR UPDATE) and always writes a row to inventory_stock_history.

const { canTransition, stockLevel } = require("./rules");

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

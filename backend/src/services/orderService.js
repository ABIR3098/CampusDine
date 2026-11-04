// CampusDine Service: Order Business Logic & Calculation Engine
const pool = require("../db");

const OrderService = {
  // Compute line items, subtotal and applicable discounts
  calculateOrderTotals(items = [], coupon = null, isBYOB = false) {
    let subtotal = 0;
    const validatedItems = items.map((item) => {
      const price = Number(item.price || 0);
      const qty = Math.max(1, Number(item.qty || 1));
      const lineTotal = price * qty;
      subtotal += lineTotal;
      return { ...item, price, qty, lineTotal };
    });

    let discount = 0;
    if (coupon) {
      if (coupon.discountType === "PERCENTAGE") {
        discount = (subtotal * Number(coupon.discountValue)) / 100;
      } else {
        discount = Number(coupon.discountValue || 0);
      }
    }

    // Bring-Your-Own-Box eco discount (-5 BDT)
    const ecoDiscount = isBYOB ? 5 : 0;
    const finalTotal = Math.max(0, subtotal - discount - ecoDiscount);

    return {
      items: validatedItems,
      subtotal,
      discount,
      ecoDiscount,
      total: finalTotal
    };
  },

  // Check inventory stock sufficiency for order
  async verifyStockAvailability(items = []) {
    for (const it of items) {
      if (!it.id) continue;
      const [rows] = await pool.query("SELECT stock_qty, is_available FROM menu_items WHERE id = ?", [it.id]);
      if (rows.length > 0) {
        if (!rows[0].is_available || rows[0].stock_qty < (it.qty || 1)) {
          return { available: false, itemName: it.name };
        }
      }
    }
    return { available: true };
  }
};

module.exports = OrderService;

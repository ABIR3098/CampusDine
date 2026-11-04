// CampusDine Validator: Order Input Payload Verification
const { MAX_QTY_PER_ITEM, MAX_CART_LINES } = require("../utils/orderRules");

function validateOrderPayload(req, res, next) {
  const { items, paymentMethod } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order must contain an array with at least one item" });
  }

  if (items.length > MAX_CART_LINES) {
    return res.status(400).json({ error: `An order can have at most ${MAX_CART_LINES} different items` });
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    // A null / non-object line used to crash here with a TypeError (HTTP 500).
    if (!it || typeof it !== "object") {
      return res.status(400).json({ error: `Item at index ${i} is not a valid item` });
    }
    if (!it.name || typeof it.name !== "string" || !it.name.trim()) {
      return res.status(400).json({ error: `Item at index ${i} is missing a valid name` });
    }
    // Number("abc") is NaN and NaN < 0 is false, so a text or Infinity price used to pass.
    if (it.price == null || it.price === "" || !Number.isFinite(Number(it.price)) || Number(it.price) < 0) {
      return res.status(400).json({ error: `Item "${it.name}" has an invalid price` });
    }
    if (it.qty != null && (Number(it.qty) <= 0 || !Number.isInteger(Number(it.qty)))) {
      return res.status(400).json({ error: `Item "${it.name}" quantity must be a positive integer` });
    }
    if (it.qty != null && Number(it.qty) > MAX_QTY_PER_ITEM) {
      return res.status(400).json({ error: `You can order at most ${MAX_QTY_PER_ITEM} of one item` });
    }
  }

  const validPaymentMethods = ["wallet", "cash", "bkash", "nagad"];
  if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: "Invalid payment method. Allowed: " + validPaymentMethods.join(", ") });
  }

  next();
}

module.exports = { validateOrderPayload };

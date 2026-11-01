// CampusDine Validator: Order Input Payload Verification
function validateOrderPayload(req, res, next) {
  const { items, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order must contain an array with at least one item" });
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.name || typeof it.name !== "string") {
      return res.status(400).json({ error: `Item at index ${i} is missing a valid name` });
    }
    if (it.price == null || Number(it.price) < 0) {
      return res.status(400).json({ error: `Item "${it.name}" has an invalid price` });
    }
    if (it.qty != null && (Number(it.qty) <= 0 || !Number.isInteger(Number(it.qty)))) {
      return res.status(400).json({ error: `Item "${it.name}" quantity must be a positive integer` });
    }
  }

  const validPaymentMethods = ["wallet", "cash", "bkash", "nagad"];
  if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: "Invalid payment method. Allowed: " + validPaymentMethods.join(", ") });
  }

  next();
}

module.exports = { validateOrderPayload };

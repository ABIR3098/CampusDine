// Pure rules for the kitchen inventory feature (no database access, so they are easy to unit test).

const UNITS = ["kg", "g", "litre", "ml", "piece", "dozen", "packet", "bottle"];
const REQUEST_TYPES = ["report", "request"];
const REQUEST_STATUSES = ["pending", "approved", "rejected", "purchased"];
const MAX_QTY = 10000000;

// pending -> approved | rejected, approved -> purchased. rejected and purchased are final.
const TRANSITIONS = {
  pending: ["approved", "rejected"],
  approved: ["purchased"],
  rejected: [],
  purchased: [],
};

function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

// Accepts numbers or numeric strings, returns a number rounded to 2 decimals or null when invalid.
function toQty(value, { allowZero = false } = {}) {
  if (value === null || value === undefined || value === "") return null;
  let n;
  if (typeof value === "number") n = value;
  else {
    // Accept what people really type: "35", "35kg", "৩৫", "1,200 kg".
    const text = String(value).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/,/g, "").trim();
    const m = text.match(/^(\d*\.?\d+)\s*[^\d\s.+-]*$/);
    n = m ? Number(m[1]) : NaN;
  }
  if (!Number.isFinite(n)) return null;
  if (n < 0 || (!allowZero && n === 0) || n > MAX_QTY) return null;
  return Math.round(n * 100) / 100;
}

function cleanText(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function validateStaffRequest(body = {}) {
  const itemId = Number(body.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) return { error: "Choose a raw material first." };
  const requestType = REQUEST_TYPES.includes(body.requestType) ? body.requestType : "request";
  const currentQty = toQty(body.currentQty, { allowZero: true });
  if (currentQty === null) return { error: "Current quantity must be a number (0 or more)." };
  const requiredQty = toQty(body.requiredQty);
  if (requiredQty === null) return { error: "Required quantity must be a number greater than 0." };
  const note = cleanText(body.note, 500);
  return { value: { itemId, requestType, currentQty, requiredQty, note } };
}

function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function validateDecision(body = {}) {
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") return { error: "Decision must be approved or rejected." };
  const reply = cleanText(body.reply, 500);
  if (decision === "rejected" && reply.length < 3) return { error: "Write a short reason when rejecting a request." };
  return { value: { decision, reply } };
}

function validatePurchase(body = {}) {
  const quantity = toQty(body.quantity);
  if (quantity === null) return { error: "Purchased quantity must be greater than 0." };
  let unitCost = null;
  if (body.unitCost !== undefined && body.unitCost !== null && body.unitCost !== "") {
    unitCost = toQty(body.unitCost, { allowZero: true });
    if (unitCost === null) return { error: "Unit cost must be a number (0 or more)." };
  }
  const itemId = body.itemId === undefined || body.itemId === null || body.itemId === "" ? null : Number(body.itemId);
  if (itemId !== null && (!Number.isInteger(itemId) || itemId <= 0)) return { error: "Invalid item." };
  const requestId = body.requestId === undefined || body.requestId === null || body.requestId === "" ? null : Number(body.requestId);
  if (requestId !== null && (!Number.isInteger(requestId) || requestId <= 0)) return { error: "Invalid request." };
  if (itemId === null && requestId === null) return { error: "Choose an item or a request to record the purchase for." };
  return {
    value: {
      itemId, requestId, quantity, unitCost,
      totalCost: unitCost === null ? null : Math.round(unitCost * quantity * 100) / 100,
      supplier: cleanText(body.supplier, 120),
      note: cleanText(body.note, 500),
    },
  };
}

function validateAdjustment(body = {}) {
  const newStock = toQty(body.newStock, { allowZero: true });
  if (newStock === null) return { error: "New stock must be a number (0 or more)." };
  const note = cleanText(body.note, 500);
  if (note.length < 3) return { error: "Write a short reason for the stock correction." };
  return { value: { newStock, note } };
}

function validateNewItem(body = {}) {
  const name = cleanText(body.name, 80);
  if (name.length < 2) return { error: "Item name is too short." };
  const unit = String(body.unit || "").toLowerCase();
  if (!UNITS.includes(unit)) return { error: `Unit must be one of: ${UNITS.join(", ")}.` };
  const stock = body.currentStock === undefined || body.currentStock === "" ? 0 : toQty(body.currentStock, { allowZero: true });
  if (stock === null) return { error: "Opening stock must be a number (0 or more)." };
  const minStock = body.minStock === undefined || body.minStock === "" ? 0 : toQty(body.minStock, { allowZero: true });
  if (minStock === null) return { error: "Minimum stock must be a number (0 or more)." };
  return { value: { name, nameBn: cleanText(body.nameBn, 80) || null, unit, currentStock: stock, minStock, category: cleanText(body.category, 40) || "General" } };
}

function stockLevel(current, min) {
  if (Number(current) <= 0) return "out";
  if (Number(min) > 0 && Number(current) <= Number(min)) return "low";
  return "ok";
}

module.exports = {
  UNITS, REQUEST_TYPES, REQUEST_STATUSES, MAX_QTY, TRANSITIONS,
  canTransition, toQty, cleanText, stockLevel,
  validateStaffRequest, validateDecision, validatePurchase, validateAdjustment, validateNewItem,
};

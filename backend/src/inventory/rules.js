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
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  if (n < 0 || (!allowZero && n === 0) || n > MAX_QTY) return null;
  return Math.round(n * 100) / 100;
}

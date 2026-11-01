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

function validateDecision(body = {}) {
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") return { error: "Decision must be approved or rejected." };
  const reply = cleanText(body.reply, 500);
  if (decision === "rejected" && reply.length < 3) return { error: "Write a short reason when rejecting a request." };
  return { value: { decision, reply } };
}

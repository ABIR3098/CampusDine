// Order rules in one place, so the route, the price preview and the tests all read the same numbers.

const STATUSES = ["Received", "Cooking", "Ready"];

// Rider tip amounts (৳) a customer may choose when paying from the wallet.
const TIP_OPTIONS = [0, 5, 10, 20];

// Rough kitchen speed used for the queue estimate shown on the Track Order page.
const AVG_MINUTES_PER_ORDER = 4;

// Cart limits: stops typo orders ("500" instead of "5") and keeps one ticket printable.
const MAX_QTY_PER_ITEM = 20;
const MAX_CART_LINES = 15;

// items: [{ id, qty }] after duplicate lines were merged. Returns an error message, or null when fine.
function validateCartLimits(items) {
  if (items.length > MAX_CART_LINES) {
    return `An order can have at most ${MAX_CART_LINES} different items`;
  }
  const tooMany = items.find((i) => Number(i.qty) > MAX_QTY_PER_ITEM);
  if (tooMany) {
    return `You can order at most ${MAX_QTY_PER_ITEM} of one item`;
  }
  return null;
}

// Clock time (ISO string) an order should be ready, given its queue estimate in minutes.
function estimateReadyAt(estMinutes, from = new Date()) {
  return new Date(from.getTime() + Number(estMinutes) * 60000).toISOString();
}

// Turns the raw numbers of a customer's orders into the summary card shown on Track Order.
// totals: { orders, spent, cancelled, monthSpent }, favourite: { name, qty } | null
function buildOrderStats(totals, favourite) {
  const orders = Number(totals.orders) || 0;
  const spent = Number(totals.spent) || 0;
  return {
    orders,
    cancelled: Number(totals.cancelled) || 0,
    spent,
    monthSpent: Number(totals.monthSpent) || 0,
    averageOrder: orders > 0 ? Math.round((spent / orders) * 100) / 100 : 0,
    favouriteItem: favourite ? { name: favourite.name, qty: Number(favourite.qty) } : null,
  };
}

// Optional ?status=&limit=&offset= for order lists. Returns { error } for bad input, otherwise
// { status, limit, offset } where limit/offset are null when not asked for (old behaviour: everything).
const ALL_STATUSES = [...STATUSES, "Cancelled"];
const MAX_PAGE_SIZE = 100;

function parseListParams(query = {}) {
  let status = null;
  if (query.status !== undefined && query.status !== "") {
    status = ALL_STATUSES.find((s) => s.toLowerCase() === String(query.status).toLowerCase());
    if (!status) return { error: `status must be one of ${ALL_STATUSES.join(", ")}` };
  }
  let limit = null;
  if (query.limit !== undefined && query.limit !== "") {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      return { error: `limit must be a whole number from 1 to ${MAX_PAGE_SIZE}` };
    }
  }
  let offset = null;
  if (query.offset !== undefined && query.offset !== "") {
    offset = Number(query.offset);
    if (!Number.isInteger(offset) || offset < 0) return { error: "offset must be 0 or more" };
  }
  return { status, limit, offset };
}

// Admin queue filters: ?status=Ready&q=C-105&from=2026-10-01&to=2026-10-31 (dates are YYYY-MM-DD, both ends included).
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (v) => DAY.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

function parseAdminFilters(query = {}) {
  const base = parseListParams({ status: query.status });
  if (base.error) return { error: base.error };
  const out = { status: base.status, q: null, from: null, to: null };
  if (query.q !== undefined && String(query.q).trim()) out.q = String(query.q).trim().slice(0, 40);
  for (const key of ["from", "to"]) {
    if (query[key] === undefined || query[key] === "") continue;
    if (!validDay(String(query[key]))) return { error: `${key} must be a date like 2026-10-31` };
    out[key] = String(query[key]);
  }
  if (out.from && out.to && out.from > out.to) return { error: "from must not be after to" };
  return out;
}

// Optional free-text reason when a customer cancels ("ordered by mistake"). Trimmed, max 100 chars, null when empty.
function cleanCancelReason(value) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, 100) || null;
}

module.exports = {
  STATUSES, TIP_OPTIONS, AVG_MINUTES_PER_ORDER,
  MAX_QTY_PER_ITEM, MAX_CART_LINES, validateCartLimits, estimateReadyAt, buildOrderStats, parseListParams, parseAdminFilters, cleanCancelReason, ALL_STATUSES, MAX_PAGE_SIZE,
};

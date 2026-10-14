// Weekly spending: own orders + the share you paid for group/treat orders, minus refunds.
const { todayStr, addDays, weekdayOf } = require("./dates");
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const weekStartOf = (dateStr) => addDays(dateStr, -weekdayOf(dateStr)); // weeks start on Sunday

async function spendRows(q, userId, sinceDate) {
  const [orders] = await q.query(
    `SELECT o.id, o.total, o.refund_amount, o.status, o.payment_method, DATE(o.created_at) AS d, s.amount AS share_amount,
            (SELECT COUNT(*) FROM order_shares x WHERE x.order_id = o.id) AS nshares
       FROM orders o LEFT JOIN order_shares s ON s.order_id = o.id AND s.user_id = ?
      WHERE DATE(o.created_at) >= ? AND ((o.user_id = ? AND NOT EXISTS (SELECT 1 FROM order_shares x WHERE x.order_id = o.id)) OR s.user_id IS NOT NULL)`,
    [userId, sinceDate, userId]);
  return orders.map((o) => {
    const gross = o.share_amount != null ? Number(o.share_amount) : Number(o.total);
    const unpaid = ["Cancelled", "Refunded"].includes(o.status) && o.payment_method !== "wallet" && !o.nshares;
    const refundFrac = Number(o.total) > 0 ? Number(o.refund_amount) / Number(o.total) : 0;
    const amount = unpaid ? 0 : round2(gross * (1 - refundFrac));
    return { id: o.id, d: String(o.d).slice(0, 10), amount, fraction: Number(o.total) > 0 ? amount / Number(o.total) : 0 };
  });
}

async function budgetStatus(q, userId) {
  const [[u]] = await q.query("SELECT weekly_budget FROM users WHERE id = ?", [userId]);
  const limit = u?.weekly_budget != null ? Number(u.weekly_budget) : null;
  const rows = await spendRows(q, userId, weekStartOf(todayStr()));
  const spent = round2(rows.reduce((s, r) => s + r.amount, 0));
  return { limit, spent, percent: limit ? Math.round((spent / limit) * 100) : null, remaining: limit != null ? round2(limit - spent) : null };
}

async function budgetReport(q, userId) {
  const today = todayStr(), weekStart = weekStartOf(today), since = addDays(weekStart, -7);
  const rows = await spendRows(q, userId, since);
  const sum = (arr) => round2(arr.reduce((s, r) => s + r.amount, 0));
  const thisWeek = rows.filter((r) => r.d >= weekStart);
  const prevWeek = rows.filter((r) => r.d < weekStart);
  const daily = [];
  for (let i = 6; i >= 0; i--) { const d = addDays(today, -i); daily.push({ day: d, spent: sum(rows.filter((r) => r.d === d)) }); }
  const byCategory = { heavy: 0, snacks: 0, drinks: 0 };
  if (thisWeek.length) {
    const [items] = await q.query(`SELECT oi.order_id, mi.category, oi.price * oi.qty AS line FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id IN (${thisWeek.map(() => "?").join(",")})`, thisWeek.map((r) => r.id));
    for (const it of items) { const f = thisWeek.find((r) => r.id === it.order_id)?.fraction || 0; byCategory[it.category] = round2((byCategory[it.category] || 0) + Number(it.line) * f); }
  }
  const status = await budgetStatus(q, userId);
  return { ...status, prevWeekSpent: sum(prevWeek), daily, byCategory, weekStart };
}

module.exports = { budgetStatus, budgetReport, weekStartOf };

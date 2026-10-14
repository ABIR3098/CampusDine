// Smoke / regression test. Run with the server already started:
//   BASE=http://localhost:5055 node tests/smoke.js
const mysql = require("mysql2/promise");
const BASE = process.env.BASE || "http://localhost:5000";
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "campusdine",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 2,
});
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`); };
async function req(path, { method = "GET", body, token, headers = {} } = {}) {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}
const login = async (externalId, password) => (await req("/api/auth/login", { method: "POST", body: { externalId, password } })).data;
async function resetTestState() {
  const tables = [
    "menu_ratings",
    "user_favorites",
    "notification_log",
    "coupon_usage",
    "payment_transactions",
    "wallet_transactions",
    "order_items",
    "orders",
  ];
  for (const table of tables) {
    try {
      await db.query(`DELETE FROM \`${table}\``);
    } catch (e) {
      console.warn(`Skipping ${table} reset:`, e.message);
    }
  }
  try {
    await db.query("DELETE FROM coupons");
    await db.query("INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, expiry_date, description, is_active) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR), ?, 1)", [
      "CAMPUS10",
      "PERCENTAGE",
      10,
      50,
      100,
      1000,
      "10% off for campus orders",
    ]);
  } catch (e) {
    console.warn("Skipping coupon reset:", e.message);
  }
  try {
    await db.query("UPDATE menu_items SET stock = 4 WHERE name = 'Fuchka'");
    await db.query("UPDATE menu_items SET stock = 40 WHERE name = 'Khichuri'");
  } catch (e) {
    console.warn("Skipping stock reset:", e.message);
  }
}

(async () => {
  await resetTestState();
  const admin = await login("admin", "admin123");
  ok("admin login", !!admin?.token);
  // last-hour deals depend on the clock; switch them off so prices are deterministic here
  await req("/api/admin/settings", { method: "PUT", token: admin.token, body: { surplus_enabled: false } });
  const uid = "t" + Date.now();
  const reg = await req("/api/auth/register", { method: "POST", body: { name: "Test", externalId: uid, role: "student", password: "secret12" } });
  ok("register", reg.status === 201, JSON.stringify(reg.data));
  const S = reg.data.token;

  const menu = (await req("/api/menu", { token: S })).data;
  ok("menu list", Array.isArray(menu) && menu.length > 0);
  const item = menu.find((m) => m.name === "Khichuri");

  // order lifecycle: Received -> Cooking -> Ready must STOP at Ready
  const o1 = await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: item.id, qty: 2 }], paymentMethod: "wallet" } });
  ok("place wallet order", o1.status === 201, JSON.stringify(o1.data));
  const id1 = o1.data.id;
  const a1 = await req(`/api/orders/${id1}/advance`, { method: "PATCH", token: admin.token });
  const a2 = await req(`/api/orders/${id1}/advance`, { method: "PATCH", token: admin.token });
  const a3 = await req(`/api/orders/${id1}/advance`, { method: "PATCH", token: admin.token });
  ok("advance Received->Cooking->Ready", a1.data?.status === "Cooking" && a2.data?.status === "Ready", JSON.stringify([a1.data?.status, a2.data?.status]));
  ok("advance past Ready is rejected (must NOT become Cancelled)", a3.status === 409 && a3.data?.status !== "Cancelled", JSON.stringify([a3.status, a3.data?.status]));

  // coupon: one order with a coupon must succeed and be discounted exactly once
  const menuTotal = 60 * 2; // 2x Khichuri
  const o2 = await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: item.id, qty: 2 }], paymentMethod: "cash", couponCode: "CAMPUS10" } });
  ok("order with coupon", o2.status === 201 && Number(o2.data.total) === menuTotal * 0.9, JSON.stringify(o2.data));
  const applied = await req("/api/coupons/apply", { method: "POST", token: S, body: { couponId: 1, orderId: o2.data?.id } });
  ok("legacy /coupons/apply cannot double-discount", applied.status >= 400, JSON.stringify(applied.data));

  // cancel refund + stock restore
  const before = (await req("/api/wallet", { token: S })).data.balance;
  const o3 = await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: item.id, qty: 1 }], paymentMethod: "wallet", mealDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) } });
  const c3 = await req(`/api/orders/${o3.data.id}/cancel`, { method: "PATCH", token: S });
  const after = (await req("/api/wallet", { token: S })).data.balance;
  ok("cancel future order refunds 100%", c3.status === 200 && Number(after) === Number(before), JSON.stringify([c3.data, before, after]));

  // bad input must produce 4xx, never crash the server
  const badMonth = await req("/api/calendar?year=abc&month=99", { token: S });
  ok("bad calendar query -> 400 (no crash)", badMonth.status === 400, String(badMonth.status));
  const health = await req("/api/health");
  ok("server still alive after bad input", health.status === 200);
  const badMenu = await req("/api/menu", { method: "POST", token: admin.token, body: { name: "X", category: "nonsense", price: 5 } });
  ok("menu POST invalid category -> 400", badMenu.status === 400, String(badMenu.status));
  const negMenu = await req("/api/menu", { method: "POST", token: admin.token, body: { name: "X", category: "snacks", price: -5 } });
  ok("menu POST negative price -> 400", negMenu.status === 400, String(negMenu.status));

  // security: unauthenticated payment callback must not confirm anything
  const cb = await req("/api/payment/nagad/callback", { method: "POST", body: { transactionId: "x", statusCode: "0000" } });
  ok("nagad callback without valid signature is rejected", cb.status >= 400, String(cb.status));

  // ratings: only rate items you have ordered
  const other = menu.find((m) => m.name === "Lassi");
  const r = await req(`/api/ratings/${other.id}`, { method: "POST", token: S, body: { rating: 5 } });
  ok("cannot rate an item never ordered", r.status === 403, String(r.status));
  const r2 = await req(`/api/ratings/${item.id}`, { method: "POST", token: S, body: { rating: 4.5 } });
  ok("fractional rating rejected", r2.status === 400, String(r2.status));

  // notifications history table must exist
  const nh = await req("/api/notifications/history", { token: S });
  ok("notification history works", nh.status === 200, String(nh.status));

  // profile: duplicate email is a 409, not a 500
  const e = `dup${Date.now()}@x.com`;
  const p1 = await req("/api/profile", { method: "PUT", token: S, body: { email: e } });
  const reg2 = await req("/api/auth/register", { method: "POST", body: { name: "T2", externalId: uid + "b", role: "student", password: "secret12" } });
  const p2 = await req("/api/profile", { method: "PUT", token: reg2.data.token, body: { email: e } });
  ok("duplicate email -> 409", p1.status === 200 && p2.status === 409, JSON.stringify([p1.status, p2.status]));

  // connection-leak check: 30 profile updates with a bad payload must not exhaust the 10-conn pool
  let leaked = false;
  for (let i = 0; i < 30; i++) { const x = await req("/api/profile", { method: "PUT", token: reg2.data.token, body: { email: e } }); if (x.status >= 500) leaked = true; }
  const alive = await req("/api/profile", { token: S });
  ok("no DB connection leak on repeated errors", !leaked && alive.status === 200, String(alive.status));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH", e); process.exit(2); });

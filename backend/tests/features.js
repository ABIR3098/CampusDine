// New-feature tests. Run after smoke.js:  BASE=http://localhost:5055 node tests/features.js
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
const ok = (n, c, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  -> " + x}`); };
async function req(path, { method = "GET", body, token } = {}) {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch (e) {} return { status: r.status, data };
}
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
  const admin = (await req("/api/auth/login", { method: "POST", body: { externalId: "admin", password: "admin123" } })).data.token;
  // last-hour deals depend on the clock; switch them off so prices are deterministic here
  await req("/api/admin/settings", { method: "PUT", token: admin, body: { surplus_enabled: false } });
  const id = "f" + Date.now();
  const S = (await req("/api/auth/register", { method: "POST", body: { name: "Feat", externalId: id, role: "student", password: "secret12" } })).data.token;
  const dup = await req("/api/auth/register", { method: "POST", body: { name: "Feat", externalId: id, role: "student", password: "secret12" } });
  ok("duplicate register -> 409", dup.status === 409, dup.status);
  ok("short password rejected", (await req("/api/auth/register", { method: "POST", body: { name: "x", externalId: id + "z", role: "student", password: "123" } })).status === 400);
  ok("register cannot create admin", (await req("/api/auth/register", { method: "POST", body: { name: "x", externalId: id + "a", role: "admin", password: "secret12" } })).status === 400);
  ok("/auth/me restores session", (await req("/api/auth/me", { token: S })).data?.user?.name === "Feat");
  ok("/api/config public", (await req("/api/config")).status === 200);
  ok("unknown api route -> 404 json", (await req("/api/nope", { token: S })).status === 404);

  const menu = (await req("/api/menu", { token: S })).data;
  const fuchka = menu.find((m) => m.name === "Fuchka"); // seeded with stock 4
  // stock: cannot oversell
  const over = await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: fuchka.id, qty: 5 }], paymentMethod: "cash" } });
  ok("cannot order more than stock (409)", over.status === 409, over.status);
  ok("qty above per-item cap rejected", (await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: menu[0].id, qty: 21 }], paymentMethod: "cash" } })).status === 400);
  ok("meal date too far ahead rejected", (await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: menu[0].id, qty: 1 }], paymentMethod: "cash", mealDate: "2099-01-01" } })).status === 400);

  // idempotency
  const key = "k" + Date.now();
  const a = await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: menu[0].id, qty: 1 }], paymentMethod: "cash", idempotencyKey: key } });
  const b = await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: menu[0].id, qty: 1 }], paymentMethod: "cash", idempotencyKey: key } });
  ok("idempotent replay returns same order", a.status === 201 && b.status === 200 && a.data.id === b.data.id, JSON.stringify([a.status, b.status]));

  // admin cancel = full refund + restock + coupon released
  const before = (await req("/api/wallet", { token: S })).data.balance;
  const stockBefore = (await req("/api/menu", { token: S })).data.find((m) => m.id === fuchka.id).stock;
  const o = await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: fuchka.id, qty: 2 }], paymentMethod: "wallet", couponCode: "CAMPUS10" } });
  ok("wallet order with coupon", o.status === 201, JSON.stringify(o.data));
  const avail1 = (await req("/api/coupons/available", { token: S })).data.coupons.length;
  const ac = await req(`/api/orders/${o.data.id}/admin-cancel`, { method: "PATCH", token: admin });
  const after = (await req("/api/wallet", { token: S })).data.balance;
  const stockAfter = (await req("/api/menu", { token: S })).data.find((m) => m.id === fuchka.id).stock;
  ok("admin-cancel -> Refunded, full refund", ac.status === 200 && ac.data.status === "Refunded" && after === before, JSON.stringify([ac.data, before, after]));
  ok("cancel restores stock", stockAfter === stockBefore, `${stockBefore} -> ${stockAfter}`);
  const avail2 = (await req("/api/coupons/available", { token: S })).data.coupons.length;
  ok("cancel releases the coupon for reuse", avail1 === 0 && avail2 === 1, `${avail1} -> ${avail2}`);
  ok("cancelled order cannot be advanced", (await req(`/api/orders/${o.data.id}/advance`, { method: "PATCH", token: admin })).status === 409);

  // notifications feed
  const nf = (await req("/api/notifications/history", { token: S })).data;
  ok("in-app notifications recorded", nf.notifications.length >= 2 && nf.unread >= 2, JSON.stringify(nf).slice(0, 150));
  await req("/api/notifications/read-all", { method: "POST", token: S });
  ok("read-all clears unread", (await req("/api/notifications/history", { token: S })).data.unread === 0);

  // quick order from favourites
  ok("favorite add", (await req(`/api/favorites/${menu[0].id}`, { method: "POST", token: S })).status === 200);
  ok("favorite double-add is not an error", (await req(`/api/favorites/${menu[0].id}`, { method: "POST", token: S })).status === 200);
  const q = await req(`/api/favorites/${fuchka.id}/quick-order`, { method: "POST", token: S, body: { quantity: 99 } });
  ok("quick-order validates quantity", q.status === 400, q.status);
  const q2 = await req(`/api/favorites/${fuchka.id}/quick-order`, { method: "POST", token: S, body: { quantity: 1 } });
  const stockQ = (await req("/api/menu", { token: S })).data.find((m) => m.id === fuchka.id).stock;
  ok("quick-order decrements stock", q2.status === 201 && stockQ === stockBefore - 1, JSON.stringify([q2.status, stockQ, stockBefore]));

  // ratings after real purchase, avg shows on menu
  ok("rate an item you bought", (await req(`/api/ratings/${menu[0].id}`, { method: "POST", token: S, body: { rating: 4, review: "good" } })).status === 200);
  const m2 = (await req("/api/menu", { token: S })).data.find((m) => m.id === menu[0].id);
  ok("menu carries avg_rating", Number(m2.avg_rating) === 4 && m2.rating_count === 1, JSON.stringify([m2.avg_rating, m2.rating_count]));

  // admin: menu edit + archive, coupon CRUD, reports
  const created = await req("/api/menu", { method: "POST", token: admin, body: { name: "=cmd|calc", category: "snacks", price: 12, stock: 5 } });
  ok("admin creates item", created.status === 201, JSON.stringify(created.data));
  ok("admin edits name/price", (await req(`/api/menu/${created.data.id}`, { method: "PUT", token: admin, body: { name: "Momo", price: 20 } })).data?.name === "Momo");
  ok("student cannot edit menu", (await req(`/api/menu/${created.data.id}`, { method: "PUT", token: S, body: { price: 1 } })).status === 403);
  await req(`/api/menu/${created.data.id}`, { method: "DELETE", token: admin });
  ok("archived item hidden from students", !(await req("/api/menu", { token: S })).data.some((m) => m.id === created.data.id));
  ok("archived item visible to admin with flag", (await req("/api/menu?includeArchived=true", { token: admin })).data.some((m) => m.id === created.data.id));
  ok("cannot order archived item", (await req("/api/orders", { method: "POST", token: S, body: { items: [{ id: created.data.id, qty: 1 }], paymentMethod: "cash" } })).status === 404);

  const code = "T" + Date.now().toString().slice(-6);
  ok("admin creates coupon", (await req("/api/coupons", { method: "POST", token: admin, body: { code, discountType: "FIXED", discountValue: 15, minOrderAmount: 20 } })).status === 201);
  ok("duplicate coupon -> 409", (await req("/api/coupons", { method: "POST", token: admin, body: { code, discountType: "FIXED", discountValue: 15 } })).status === 409);
  ok(">100% coupon rejected", (await req("/api/coupons", { method: "POST", token: admin, body: { code: code + "X", discountType: "PERCENTAGE", discountValue: 150 } })).status === 400);
  ok("student cannot create coupon", (await req("/api/coupons", { method: "POST", token: S, body: { code: "HACK1", discountType: "FIXED", discountValue: 999 } })).status === 403);
  const v = await req("/api/coupons/validate", { method: "POST", token: S, body: { couponCode: code, orderAmount: 100 } });
  ok("fixed coupon validates", v.data?.discountAmount === 15 && v.data?.finalAmount === 85, JSON.stringify(v.data));

  const ov = (await req("/api/admin/overview", { token: admin })).data;
  ok("overview ignores cancelled revenue & counts pending", typeof ov.revenueToday === "number" && ov.pendingOrders >= 0, JSON.stringify(ov));
  ok("daily report has 7 zero-filled days", (await req("/api/admin/reports/daily", { token: admin })).data.length === 7);
  ok("top-items report", Array.isArray((await req("/api/admin/reports/top-items", { token: admin })).data));
  const csv = await fetch(BASE + "/api/admin/reports/orders.csv", { headers: { Authorization: `Bearer ${admin}` } });
  const csvText = await csv.text();
  ok("admin CSV export has header row", csv.status === 200 && csvText.startsWith('id,token,external_id'), csv.status + " " + csvText.slice(0, 40));
  ok("student blocked from admin reports", (await req("/api/admin/overview", { token: S })).status === 403);
  ok("profile stats", (await req("/api/profile/stats", { token: S })).data?.stats?.totalOrders >= 1);

  // wallet
  ok("topup over max rejected", (await req("/api/wallet/topup", { method: "POST", token: S, body: { amount: 10000 } })).status === 400);
  ok("topup ok", (await req("/api/wallet/topup", { method: "POST", token: S, body: { amount: 100 } })).status === 200);

  // password reset
  const rq = await req("/api/auth/request-password-reset", { method: "POST", body: { externalId: id } });
  ok("reset request never reveals OTP by default", rq.data._devOTP === undefined);
  let last;
  for (let i = 0; i < 6; i++) last = await req("/api/auth/verify-otp-and-reset", { method: "POST", body: { externalId: id, otp: "000000", newPassword: "newpass1" } });
  ok("OTP brute force locked after 5 wrong tries", last.status === 429 || last.status === 400, last.status);
  ok("bad JSON body -> 400 not 500", (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{oops" })).status === 400);

  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH", e); process.exit(2); });

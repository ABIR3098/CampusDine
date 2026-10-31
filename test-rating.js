// test-rating.js — tests the "Rate your rider" system from the terminal, step by step.
// It makes ONE small cash test order, delivers it, rates the rider, checks everything, then removes the test order.
// Needs: backend running (npm start) and MySQL on.   Run from the project MAIN folder:  node test-rating.js
const fs = require("fs");
const path = require("path");

if (typeof fetch !== "function") { console.error("Your Node.js is too old. Install Node 18 or newer."); process.exit(1); }
if (!fs.existsSync("backend/server.js")) { console.error("Run this from the project's MAIN folder."); process.exit(1); }

const env = {};
try {
  for (const line of fs.readFileSync("backend/.env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (_) {}
const BASE = "http://localhost:" + (env.PORT || 5000);

let failed = 0, step = 0;
const pass = (msg) => console.log(`  ✅ ${++step}. ${msg}`);
const fail = (msg, hint) => { failed++; console.log(`  ❌ ${++step}. ${msg}` + (hint ? `\n        → ${hint}` : "")); };
const call = async (method, p, token, body) => {
  const r = await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch (_) {}
  return { status: r.status, data };
};
const login = async (id, pw) => { const r = await call("POST", "/api/auth/login", null, { externalId: id, password: pw }); return r.status === 200 ? r.data.token : null; };

(async () => {
  console.log("\nTesting the rating system on " + BASE + "\n");
  let state = { orderId: null, itemId: null, riderToken: null };
  try {
    // 1) server
    const ping = await call("GET", "/api/menu").catch(() => null);
    if (!ping) { fail("backend is not running", "open a terminal:  cd backend  then  npm start   (keep it open), then run this test again"); return; }
    pass("backend is running");

    // 2) logins
    const student = await login("student1", "student123"), admin = await login("admin", "admin123"), rider = await login("rider1", "rider123");
    state.riderToken = rider;
    if (!student || !admin || !rider) { fail("could not log in as student1 / admin / rider1 with the demo passwords", "this test needs the demo accounts (student1/student123, admin/admin123, rider1/rider123)"); return; }
    pass("logged in as student, admin and rider");

    // 3) an item that can be ordered
    const menu = (await call("GET", "/api/menu", student)).data || [];
    const item = menu.filter((m) => m.availability === "available" && Number(m.stock) > 0).sort((a, b) => a.price - b.price)[0];
    if (!item) { fail("no menu item with stock to use for the test order", "give any item some stock in the admin menu manager"); return; }
    state.itemId = item.id;
    pass(`test item: ${item.name} (৳${item.price})`);

    // 4) rider on duty
    await call("POST", "/api/riders/location", rider, { latitude: 23.8103, longitude: 90.4125 });
    const shift = await call("POST", "/api/operations/riders/shift/start", rider, { maxOrders: 5 });
    if (shift.status >= 400 && shift.status !== 409) { fail("rider could not start the duty shift (HTTP " + shift.status + ")"); return; }
    pass("rider is on duty");

    // 5) order (cash)
    const order = await call("POST", "/api/orders", student, { items: [{ id: item.id, qty: 1 }], paymentMethod: "cash" });
    if (order.status !== 201) { fail("could not place the test order: " + ((order.data && order.data.error) || "HTTP " + order.status)); return; }
    state.orderId = order.data.id;
    if (!order.data.rider_id) { fail("order was placed but NO rider was assigned", "rider must press Start GPS sharing + Start duty shift in the rider dashboard; the GPS must be fresh (under 90 seconds)"); return; }
    pass(`test order ${order.data.token} placed and given to a rider`);

    // 6) cannot rate before delivery
    const early = await call("POST", `/api/orders/${order.data.id}/rate-rider`, student, { rating: 5 });
    if (early.status === 404 && !(early.data && early.data.error === "Order not found")) { fail("rating route does not exist on the server", "run: node rate-rider.js  then restart the backend (Ctrl+C, cd backend, npm start)"); return; }
    early.status === 409 ? pass("rating is blocked before delivery (correct)") : fail("rating before delivery should be refused (got HTTP " + early.status + ")");

    // 7) deliver: Received -> Cooking -> Ready -> collected
    await call("PATCH", `/api/orders/${order.data.id}/advance`, admin);
    await call("PATCH", `/api/orders/${order.data.id}/advance`, admin);
    const collect = await call("POST", "/api/orders/verify", admin, { code: order.data.token, collect: true });
    collect.status === 200 ? pass("order marked Ready and handed over") : fail("could not mark the order as handed over (HTTP " + collect.status + ")");

    // 8) bad ratings are refused
    const r0 = await call("POST", `/api/orders/${order.data.id}/rate-rider`, student, { rating: 0 });
    const r6 = await call("POST", `/api/orders/${order.data.id}/rate-rider`, student, { rating: 6 });
    r0.status === 400 && r6.status === 400 ? pass("ratings 0 and 6 are refused (correct)") : fail("invalid ratings should be refused with 400 (got " + r0.status + " and " + r6.status + ")");

    // 9) a real rating
    const good = await call("POST", `/api/orders/${order.data.id}/rate-rider`, student, { rating: 5, comment: "test rating" });
    if (good.status === 200) pass("5-star rating saved");
    else if (good.status >= 500) fail("server error while saving the rating", "restart the backend once so the new database columns are created, then run this test again");
    else fail("rating was not saved (HTTP " + good.status + "): " + ((good.data && good.data.error) || ""));

    // 10) only once
    const again = await call("POST", `/api/orders/${order.data.id}/rate-rider`, student, { rating: 1 });
    again.status === 409 ? pass("second rating on the same order is refused (correct)") : fail("a second rating should be refused (got HTTP " + again.status + ")");

    // 11) student sees it
    const mine = ((await call("GET", "/api/orders/mine", student)).data || []).find((o) => o.id === order.data.id);
    mine && Number(mine.rider_rating) === 5 ? pass(`student's Orders list shows ${mine.rider_rating} stars for rider ${mine.rider_name || ""}`) : fail("student's order does not show the saved rating");

    // 12) rider sees it
    const sum = (await call("GET", "/api/riders/orders/summary", rider)).data || {};
    Number(sum.rating_count) >= 1 ? pass(`rider dashboard shows average ⭐ ${Number(sum.rating_avg).toFixed(1)} from ${sum.rating_count} rating(s) (includes this test for now)`) : fail("rider dashboard has no rating data", "restart the backend after applying rate-rider.js");
  } catch (e) {
    fail("test stopped by an unexpected error: " + e.message);
  } finally {
    // clean up the test order, so the rider's average and the stock stay correct
    try {
      await call("POST", "/api/operations/riders/shift/end", state.riderToken).catch(() => {});
      if (state.orderId) {
        const mysql = require(path.resolve("backend/node_modules/mysql2/promise"));
        const db = await mysql.createConnection({ host: env.DB_HOST || "localhost", port: Number(env.DB_PORT || 3306), user: env.DB_USER || "root", password: env.DB_PASSWORD || "", database: env.DB_NAME || "campusdine" });
        try {
          await db.query("DELETE FROM order_items WHERE order_id = ?", [state.orderId]);
          await db.query("DELETE FROM orders WHERE id = ?", [state.orderId]);
          await db.query("UPDATE menu_items SET stock = stock + 1 WHERE id = ?", [state.itemId]);
          console.log("\n  🧹 test order removed and stock restored");
        } catch (_) {
          await db.query("UPDATE orders SET rider_rating = NULL, rider_comment = NULL, rider_rated_at = NULL WHERE id = ?", [state.orderId]).catch(() => {});
          console.log("\n  🧹 test order kept in the database (harmless), but its test rating was cleared");
        }
        await db.end();
      }
    } catch (_) {}
    console.log("\n" + (failed === 0 ? "✅ RATING SYSTEM IS WORKING — all checks passed." : `❌ ${failed} check(s) failed — read the → hint under each ❌.`) + "\n");
  }
})();

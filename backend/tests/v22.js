// Tests for the 13 v2.2 features. Needs the same DB_* env vars as the server (it seeds a little history directly).
//   BASE=http://localhost:5055 DB_USER=root DB_PASSWORD= DB_HOST=127.0.0.1 node tests/v22.js
const BASE = process.env.BASE || "http://localhost:5000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  -> " + String(x).slice(0, 220)}`); };
async function req(path, { method = "GET", body, token, raw } = {}) {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (raw) return { status: r.status, text: await r.text(), type: r.headers.get("content-type") };
  let data = null; try { data = await r.json(); } catch (e) {} return { status: r.status, data };
}
const dhaka = () => new Date(Date.now() + 6 * 3600e3);
const ymd = (d) => d.toISOString().slice(0, 10);
const TODAY = ymd(dhaka()), TOMORROW = ymd(new Date(dhaka().getTime() + 864e5));
const stamp = Date.now().toString(36);
const mkUser = async (tag) => { const r = await req("/api/auth/register", { method: "POST", body: { name: `U ${tag}`, externalId: `${tag}${stamp}`, role: "student", password: "secret12" } }); return { token: r.data.token, id: r.data.user.id, ext: `${tag}${stamp}`, name: `U ${tag}` }; };
const slotsOf = async (token, date) => (await req(`/api/slots?date=${date}`, { token })).data.slots;
const pickSlot = async (token, date, from = "11:00", kind = "lunch", nth = 0) => (await slotsOf(token, date)).filter((s) => s.available && s.time >= from && s.kind === kind && s.time < "12:30")[nth];
const bal = async (u) => (await req("/api/wallet", { token: u.token })).data.balance;

(async () => {
  const db = require("../src/db");
  const tables = [
    "group_items",
    "group_members",
    "group_orders",
    "order_shares",
    "treats",
    "points_log",
    "class_schedule",
    "menu_ratings",
    "user_favorites",
    "notification_log",
    "coupon_usage",
    "payment_transactions",
    "wallet_transactions",
    "order_items",
    "orders",
  ];
  for (const t of tables) {
    try { await db.query(`DELETE FROM \`${t}\``); } catch (e) {}
  }
  try {
    await db.query("UPDATE menu_items SET stock = 4 WHERE name = 'Fuchka'");
    await db.query("UPDATE menu_items SET stock = 40 WHERE name = 'Khichuri'");
    await db.query("UPDATE menu_items SET stock = 30 WHERE name = 'Tehari'");
  } catch (e) {}

  const adminToken = (await req("/api/auth/login", { method: "POST", body: { externalId: "admin", password: "admin123" } })).data.token;
  const A = adminToken;
  const set = (body) => req("/api/admin/settings", { method: "PUT", token: A, body });
  await set({ open_time: "00:00", close_time: "23:50", slot_capacity: 2, surplus_enabled: false, ramadan_mode: false, jummah_mode: false });

  const menu = (await req("/api/menu", { token: (await mkUser("m")).token })).data;
  const byName = (n) => menu.find((m) => m.name === n);
  const khichuri = byName("Khichuri"), tehari = byName("Tehari"), fuchka = byName("Fuchka");

  // ── Settings & config ─────────────────────────────────────────────
  const stu = await mkUser("s");
  ok("settings: student forbidden", (await req("/api/admin/settings", { token: stu.token })).status === 403);
  ok("settings: bad time -> 400", (await set({ open_time: "25:99" })).status === 400);
  ok("settings: open >= close -> 400", (await set({ open_time: "20:00", close_time: "10:00" })).status === 400);
  ok("settings: out-of-range percent -> 400", (await set({ surplus_percent: 99 })).status === 400);
  ok("/api/config exposes mode flags", (await req("/api/config")).data.ramadanMode === false);

  // ── 1. Pickup slots + live rush meter ─────────────────────────────
  const a = await mkUser("a"), b = await mkUser("b"), c = await mkUser("c"), d = await mkUser("d");
  const sl = await pickSlot(a.token, TOMORROW, "11:00", "lunch", 0);
  ok("slots listed with capacity + status", sl && sl.capacity === 2 && sl.status === "quiet", JSON.stringify(sl));
  const place = (u, slot, extra = {}) => req("/api/orders", { method: "POST", token: u.token, body: { items: [{ id: khichuri.id, qty: 1 }], paymentMethod: "cash", mealDate: TOMORROW, pickupSlot: slot, ...extra } });
  const o1 = await place(a, sl.time), o2 = await place(b, sl.time), o3 = await place(c, sl.time);
  ok("two bookings fit the slot", o1.status === 201 && o2.status === 201 && o1.data.pickup_slot === sl.time, `${o1.status} ${o2.status}`);
  ok("third booking -> 409 slot full", o3.status === 409 && /full/i.test(o3.data.error), JSON.stringify(o3.data));
  const after = (await slotsOf(a.token, TOMORROW)).find((s) => s.time === sl.time);
  ok("rush meter shows full + unavailable", after.status === "full" && after.available === false && after.booked === 2);
  const cancelled = await req(`/api/orders/${o1.data.id}/cancel`, { method: "PATCH", token: a.token });
  ok("cancelling frees the slot", cancelled.status === 200 && (await slotsOf(a.token, TOMORROW)).find((s) => s.time === sl.time).booked === 1);
  ok("invalid slot time -> 400", (await place(c, "03:07")).status === 400);
  ok("past slot today -> 409", (await req("/api/orders", { method: "POST", token: c.token, body: { items: [{ id: khichuri.id, qty: 1 }], paymentMethod: "cash", pickupSlot: "00:00" } })).status === 409 || dhaka().getUTCHours() * 60 + dhaka().getUTCMinutes() === 0);
  const fri = (() => { for (let i = 1; i < 8; i++) { const x = new Date(dhaka().getTime() + i * 864e5); if (x.getUTCDay() === 5) return ymd(x); } })();
  await set({ jummah_mode: true });
  const friSlots = await slotsOf(a.token, fri);
  ok("Friday: Jummah break has no slots, shoulders get extra capacity", !friSlots.some((s) => s.time >= "12:30" && s.time < "14:00") && friSlots.some((s) => s.time === "12:20") && friSlots.some((s) => s.time === "14:00") && friSlots[0].capacity === 3, friSlots.map((s) => s.time).slice(70, 90).join());

  await set({ jummah_mode: false });

  // ── 2. Class timetable ────────────────────────────────────────────
  const wd = new Date(`${TOMORROW}T00:00:00Z`).getUTCDay();
  const k1 = await req("/api/schedule", { method: "POST", token: d.token, body: { weekday: wd, start: "10:00", end: "11:00", title: "Algorithms" } });
  ok("add a class", k1.status === 201, JSON.stringify(k1.data));
  ok("overlapping class -> 409", (await req("/api/schedule", { method: "POST", token: d.token, body: { weekday: wd, start: "10:30", end: "11:30", title: "Clash" } })).status === 409);
  ok("end before start -> 400", (await req("/api/schedule", { method: "POST", token: d.token, body: { weekday: wd, start: "12:00", end: "11:00", title: "x" } })).status === 400);
  const ds = await slotsOf(d.token, TOMORROW);
  ok("slots flag clashes with lectures (+5 min walk buffer)", ds.find((s) => s.time === "10:00").clash === "Algorithms" && ds.find((s) => s.time === "09:50").clash === "Algorithms" && ds.find((s) => s.time === "12:00").clash === null);
  const sg = (await req(`/api/schedule/suggest?date=${TOMORROW}`, { token: d.token })).data;
  const sugg = ds.find((s) => s.time === sg.suggestedSlot);
  ok("suggestion avoids classes and has free windows", sg.suggestedSlot && sugg && sugg.clash === null && sg.free.length >= 1 && /free at/i.test(sg.message), JSON.stringify(sg).slice(0, 200));
  ok("other users don't see my classes", (await slotsOf(a.token, TOMORROW)).find((s) => s.time === "10:00").clash === null);
  ok("delete class", (await req(`/api/schedule/${k1.data.id}`, { method: "DELETE", token: d.token })).status === 200);

  // ── 3. Last-hour surplus deals ────────────────────────────────────
  const nowM = dhaka().getUTCHours() * 60 + dhaka().getUTCMinutes();
  const closeM = Math.min(nowM + 20, 23 * 60 + 59);
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  await set({ open_time: "00:00", close_time: hm(closeM), surplus_enabled: true, surplus_percent: 30, surplus_minutes: 45 });
  const dm = (await req("/api/menu", { token: stu.token })).data.find((m) => m.id === khichuri.id);
  ok("menu shows the deal price", dm.surplus_active === true && dm.surplus_price === 42, JSON.stringify([dm.surplus_active, dm.surplus_price]));
  const before = (await req("/api/rewards/impact", { token: stu.token })).data.mealsSaved;
  const dealOrder = await req("/api/orders", { method: "POST", token: stu.token, body: { items: [{ id: khichuri.id, qty: 2 }], paymentMethod: "cash" } });
  ok("today's order gets 30% off", dealOrder.status === 201 && dealOrder.data.total === 84 && dealOrder.data.savings === 36, JSON.stringify(dealOrder.data).slice(0, 200));
  const tomorrowOrder = await req("/api/orders", { method: "POST", token: stu.token, body: { items: [{ id: khichuri.id, qty: 1 }], paymentMethod: "cash", mealDate: TOMORROW } });
  ok("tomorrow's order pays full price", tomorrowOrder.data.total === 60);
  ok("waste counter rises (meals saved)", (await req("/api/rewards/impact", { token: stu.token })).data.mealsSaved === before + 2);
  const myDeal = (await req("/api/orders/mine", { token: stu.token })).data.find((o) => o.id === dealOrder.data.id);
  ok("order lines remember the original price", Number(myDeal.items[0].original_price) === 60 && Number(myDeal.items[0].price) === 42);
  await set({ close_time: "23:50", surplus_enabled: false });

  // ── 9. Dietary tags ───────────────────────────────────────────────
  await req(`/api/menu/${fuchka.id}`, { method: "PUT", token: A, body: { hasNuts: true, spiceLevel: 3 } });
  const names = async (q) => (await req(`/api/menu?${q}`, { token: stu.token })).data.map((m) => m.name);
  ok("filter: vegetarian only", !(await names("veg=true")).includes("Tehari") && (await names("veg=true")).includes("Khichuri"));
  ok("filter: max spice 1", !(await names("maxSpice=1")).includes("Fuchka") && (await names("maxSpice=1")).includes("Khichuri"));
  ok("filter: no nuts", !(await names("nonuts=true")).includes("Fuchka"));
  ok("invalid spice level -> 400", (await req(`/api/menu/${fuchka.id}`, { method: "PUT", token: A, body: { spiceLevel: 5 } })).status === 400);
  ok("menu rows carry tags", (await req("/api/menu", { token: stu.token })).data.find((m) => m.id === fuchka.id).has_nuts === 1);

  // ── 7. Ramadan / iftar ────────────────────────────────────────────
  ok("iftar items hidden outside Ramadan", !(await names("")).includes("Haleem"));
  const haleemId = (await req("/api/menu?includeArchived=true", { token: A })).data.find((m) => m.name === "Haleem").id;
  ok("can't order an iftar item outside Ramadan", (await req("/api/orders", { method: "POST", token: stu.token, body: { items: [{ id: haleemId, qty: 1 }], paymentMethod: "cash", mealDate: TOMORROW } })).status === 404);
  await set({ ramadan_mode: true, maghrib_time: "18:00" });
  ok("Ramadan mode reveals iftar items", (await names("")).includes("Haleem"));
  const iftarSlots = (await slotsOf(stu.token, TOMORROW)).filter((s) => s.kind === "iftar");
  ok("iftar slots end before Maghrib", iftarSlots.length === 5 && iftarSlots[0].time === "17:00" && iftarSlots[4].endTime === "17:50", iftarSlots.map((s) => s.time).join());
  const hBody = (slot) => ({ items: [{ id: haleemId, qty: 1 }], paymentMethod: "cash", mealDate: TOMORROW, ...(slot ? { pickupSlot: slot } : {}) });
  ok("iftar item needs a slot", (await req("/api/orders", { method: "POST", token: stu.token, body: hBody(null) })).status === 400);
  ok("iftar item rejects a lunch slot", (await req("/api/orders", { method: "POST", token: stu.token, body: hBody("11:20") })).status === 400);
  ok("iftar item + iftar slot works", (await req("/api/orders", { method: "POST", token: stu.token, body: hBody("17:20") })).status === 201);
  await set({ ramadan_mode: false });

  // ── 4. Group orders (equal split, atomic payment) ─────────────────
  const g1 = await mkUser("g1"), g2 = await mkUser("g2"), g3 = await mkUser("g3"), outsider = await mkUser("g4");
  const gslot = await pickSlot(g1.token, TOMORROW, "11:00", "lunch", 4);
  const gr = await req("/api/groups", { method: "POST", token: g1.token, body: { name: "Lab buddies", splitMode: "equal", mealDate: TOMORROW, pickupSlot: gslot.time } });
  ok("create group", gr.status === 201 && gr.data.code.length === 6 && gr.data.members.length === 1, JSON.stringify(gr.data).slice(0, 150));
  const code = gr.data.code;
  ok("members join with the code", (await req("/api/groups/join", { method: "POST", token: g2.token, body: { code: code.toLowerCase() } })).status === 200 && (await req("/api/groups/join", { method: "POST", token: g3.token, body: { code } })).status === 200);
  ok("non-member can't view the group", (await req(`/api/groups/${code}`, { token: outsider.token })).status === 403);
  await req(`/api/groups/${code}/items`, { method: "PUT", token: g1.token, body: { itemId: khichuri.id, qty: 2 } });
  const gv = await req(`/api/groups/${code}/items`, { method: "PUT", token: g2.token, body: { itemId: tehari.id, qty: 1 } });
  ok("shared cart totals + equal shares", gv.data.total === 200 && gv.data.members.map((m) => m.share).sort().join() === "66.66,66.66,66.68", JSON.stringify(gv.data.members.map((m) => m.share)));
  for (const u of [g1, g2]) await req(`/api/groups/${code}/confirm`, { method: "POST", token: u.token, body: {} });
  ok("checkout blocked until everyone confirms", (await req(`/api/groups/${code}/checkout`, { method: "POST", token: g1.token })).status === 409);
  await req(`/api/groups/${code}/confirm`, { method: "POST", token: g3.token, body: {} });
  const changed = await req(`/api/groups/${code}/items`, { method: "PUT", token: g3.token, body: { itemId: khichuri.id, qty: 0 } });
  ok("changing the cart resets confirmations", changed.data.allConfirmed === false);
  for (const u of [g1, g2, g3]) await req(`/api/groups/${code}/confirm`, { method: "POST", token: u.token, body: {} });
  ok("only the host can check out", (await req(`/api/groups/${code}/checkout`, { method: "POST", token: g2.token })).status === 403);
  const b0 = [await bal(g1), await bal(g2), await bal(g3)];
  const co = await req(`/api/groups/${code}/checkout`, { method: "POST", token: g1.token });
  const b1 = [await bal(g1), await bal(g2), await bal(g3)];
  ok("group order placed; each wallet pays its share", co.status === 201 && Math.abs((b0[0] - b1[0]) - 66.68) < 0.001 && Math.abs((b0[1] - b1[1]) - 66.66) < 0.001 && Math.abs((b0[2] - b1[2]) - 66.66) < 0.001, JSON.stringify([co.data, b0, b1]));
  const memberOrders = (await req("/api/orders/mine", { token: g3.token })).data;
  const mine = memberOrders.find((o) => o.id === co.data.orderId);
  ok("every member sees the group order (with who paid)", mine && mine.kind === "group" && mine.shares.length === 3 && mine.pickup_slot === gslot.time);
  ok("closed group can't be edited", (await req(`/api/groups/${code}/items`, { method: "PUT", token: g1.token, body: { itemId: khichuri.id, qty: 1 } })).status === 409);
  ok("only the host cancels the group order", (await req(`/api/orders/${co.data.orderId}/cancel`, { method: "PATCH", token: g2.token })).status === 404);
  const cx = await req(`/api/orders/${co.data.orderId}/cancel`, { method: "PATCH", token: g1.token });
  const b2 = [await bal(g1), await bal(g2), await bal(g3)];
  ok("cancelling refunds every payer their own share", cx.status === 200 && cx.data.status === "Refunded" && b2.every((x, i) => Math.abs(x - b0[i]) < 0.001), JSON.stringify([cx.data.status, b0, b2]));
  // insufficient funds: nothing may change
  const poor = await mkUser("g5");
  const gr2 = await req("/api/groups", { method: "POST", token: g1.token, body: { name: "Too much", splitMode: "own", mealDate: TOMORROW } });
  await req("/api/groups/join", { method: "POST", token: poor.token, body: { code: gr2.data.code } });
  await req(`/api/groups/${gr2.data.code}/items`, { method: "PUT", token: g1.token, body: { itemId: khichuri.id, qty: 1 } });
  await req(`/api/groups/${gr2.data.code}/items`, { method: "PUT", token: poor.token, body: { itemId: tehari.id, qty: 4 } }); // 320 > 250
  for (const u of [g1, poor]) await req(`/api/groups/${gr2.data.code}/confirm`, { method: "POST", token: u.token, body: {} });
  const stockBefore = (await req("/api/menu", { token: g1.token })).data.find((m) => m.id === tehari.id).stock;
  const pb = await bal(g1);
  const fail1 = await req(`/api/groups/${gr2.data.code}/checkout`, { method: "POST", token: g1.token });
  ok("a member short on money blocks checkout (402, names them)", fail1.status === 402 && /U g5/.test(fail1.data.error), JSON.stringify(fail1.data));
  ok("…and nothing was charged or reserved", (await bal(g1)) === pb && (await req("/api/menu", { token: g1.token })).data.find((m) => m.id === tehari.id).stock === stockBefore && (await req(`/api/groups/${gr2.data.code}`, { token: g1.token })).data.status === "open");
  ok("host can cancel an open group", (await req(`/api/groups/${gr2.data.code}`, { method: "DELETE", token: g1.token })).status === 200);

  // ── 5. Treat a friend ─────────────────────────────────────────────
  const t1 = await mkUser("t1"), t2 = await mkUser("t2");
  ok("lookup friend by ID", (await req(`/api/treats/lookup?externalId=${t2.ext}`, { token: t1.token })).data.name === t2.name);
  ok("can't treat yourself", (await req("/api/treats", { method: "POST", token: t1.token, body: { toExternalId: t1.ext, kind: "credit", amount: 10 } })).status === 400);
  ok("can't treat an admin / unknown ID", (await req("/api/treats", { method: "POST", token: t1.token, body: { toExternalId: "admin", kind: "credit", amount: 10 } })).status === 404);
  const c0 = [await bal(t1), await bal(t2)];
  const cr = await req("/api/treats", { method: "POST", token: t1.token, body: { toExternalId: t2.ext, kind: "credit", amount: 40, message: "Good luck!" } });
  ok("credit treat moves money", cr.status === 201 && (await bal(t1)) === c0[0] - 40 && (await bal(t2)) === c0[1] + 40);
  ok("treat > balance -> 402", (await req("/api/treats", { method: "POST", token: t1.token, body: { toExternalId: t2.ext, kind: "credit", amount: 900 } })).status === 402);
  ok("friend gets a notification", (await req("/api/notifications/history", { token: t2.token })).data.notifications.some((n) => /Good luck/.test(n.message)));
  const tslot = await pickSlot(t1.token, TOMORROW, "11:00", "lunch", 6);
  const tb = await bal(t1);
  const mt = await req("/api/treats", { method: "POST", token: t1.token, body: { toExternalId: t2.ext, kind: "meal", menuItemId: tehari.id, qty: 1, mealDate: TOMORROW, pickupSlot: tslot.time, message: "Lunch on me" } });
  ok("meal treat charges the sender", mt.status === 201 && (await bal(t1)) === tb - 80, JSON.stringify(mt.data));
  const friendOrder = (await req("/api/orders/mine", { token: t2.token })).data.find((o) => o.id === mt.data.orderId);
  ok("friend owns the order, labelled with sender + message", friendOrder && friendOrder.user_id === t2.id && /Treat from U t1.*Lunch on me/.test(friendOrder.label) && friendOrder.kind === "treat");
  ok("sender can follow the treat too", (await req("/api/orders/mine", { token: t1.token })).data.some((o) => o.id === mt.data.orderId));
  const t2b = await bal(t2);
  const decline = await req(`/api/orders/${mt.data.orderId}/cancel`, { method: "PATCH", token: t2.token });
  ok("if the friend declines, the SENDER is refunded", decline.status === 200 && (await bal(t1)) === tb && (await bal(t2)) === t2b);
  const hist = (await req("/api/treats", { token: t1.token })).data;
  ok("treat history lists sent treats", hist.sent.length === 2 && hist.sent[0].kind === "meal");

  // ── 6. QR pickup + 8. points/streaks ──────────────────────────────
  const q = await mkUser("q"), other = await mkUser("o");
  const qo = (await req("/api/orders", { method: "POST", token: q.token, body: { items: [{ id: khichuri.id, qty: 1 }], paymentMethod: "cash" } })).data;
  const qr = await req(`/api/orders/${qo.id}/qr`, { token: q.token, raw: true });
  ok("QR is an SVG for the owner", qr.status === 200 && /svg/.test(qr.type) && qr.text.startsWith("<svg"));
  ok("another student can't fetch it", (await req(`/api/orders/${qo.id}/qr`, { token: other.token, raw: true })).status === 404);
  ok("admin can fetch it", (await req(`/api/orders/${qo.id}/qr`, { token: A, raw: true })).status === 200);
  const short = qo.token.slice(0, 8).toUpperCase();
  const early = await req("/api/orders/pickup", { method: "POST", token: A, body: { code: short } });
  ok("can't hand over food that isn't ready", early.status === 409 && /not Ready|Received/.test(early.data.error), JSON.stringify(early.data));
  const queue1 = (await req("/api/orders/queue/mine", { token: q.token })).data.queue[qo.id];
  ok("queue position + ETA for an active order", queue1 && queue1.ahead >= 0 && queue1.etaMinutes >= 1, JSON.stringify(queue1));
  const qo2 = (await req("/api/orders", { method: "POST", token: q.token, body: { items: [{ id: khichuri.id, qty: 1 }], paymentMethod: "cash" } })).data;
  const queue2 = (await req("/api/orders/queue/mine", { token: q.token })).data.queue;
  ok("later orders queue behind earlier ones", queue2[qo2.id].ahead > queue2[qo.id].ahead, JSON.stringify(queue2));
  await req(`/api/orders/${qo.id}/advance`, { method: "PATCH", token: A }); await req(`/api/orders/${qo.id}/advance`, { method: "PATCH", token: A });
  ok("admin overview counts ready-but-uncollected", (await req("/api/admin/overview", { token: A })).data.awaitingPickup >= 1);
  const got = await req("/api/orders/pickup", { method: "POST", token: A, body: { code: `CD:${qo.token}` } });
  ok("scanning the QR text collects the order", got.status === 200 && got.data.picked_up_at && got.data.customer === q.name, JSON.stringify(got.data).slice(0, 160));
  ok("double scan -> 409 already collected", (await req("/api/orders/pickup", { method: "POST", token: A, body: { code: short } })).status === 409);
  ok("unknown code -> 404", (await req("/api/orders/pickup", { method: "POST", token: A, body: { code: "ZZZZZZZZ" } })).status === 404);
  ok("students can't use pickup", (await req("/api/orders/pickup", { method: "POST", token: q.token, body: { code: short } })).status === 403);
  const rw = (await req("/api/rewards", { token: q.token })).data;
  ok("collecting earns points + starts a streak", rw.points === 10 && rw.streak === 1 && rw.log[0].reason === "Meal collected", JSON.stringify(rw).slice(0, 200));
  await req(`/api/orders/${qo2.id}/advance`, { method: "PATCH", token: A }); await req(`/api/orders/${qo2.id}/advance`, { method: "PATCH", token: A });
  await req("/api/orders/pickup", { method: "POST", token: A, body: { code: qo2.token } });
  const rw2 = (await req("/api/rewards", { token: q.token })).data;
  ok("second meal same day: +10, streak unchanged", rw2.points === 20 && rw2.streak === 1);
  const pk = (await req("/api/admin/reports/pickup", { token: A })).data;
  ok("pickup report", pk.collectedToday >= 2 && Array.isArray(pk.waiting));

  // streak rules, directly against the DB with fixed dates
  const { awardMeal } = require("../src/utils/loyalty");
  const [ur] = await db.query("INSERT INTO users (name, external_id, role, password_hash, wallet_balance) VALUES ('Streaky', ?, 'student', 'x', 0)", [`streak${stamp}`]);
  const sid = ur.insertId;
  const run = async (date) => (await awardMeal(db, sid, date)).streak;
  const seq = [];
  for (const day of ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-11", "2026-10-12", "2026-10-14"]) seq.push(await run(day));
  ok("streaks: consecutive days count, Fri/Sat are skipped, a missed day resets", seq.join() === "1,2,3,4,5,6,7,1", seq.join());
  const [[lrow]] = await db.query("SELECT best_streak, points FROM loyalty WHERE user_id = ?", [sid]);
  ok("5-day milestone bonus + best streak recorded", lrow.best_streak === 7 && lrow.points > 100, JSON.stringify(lrow));
  const same = await run("2026-10-14");
  ok("same-day repeat doesn't change the streak", same === 1);

  // redeem points → private coupon
  await db.query("UPDATE loyalty SET points = 300 WHERE user_id IN (SELECT id FROM users WHERE external_id = ?)", [q.ext]);
  const poorRedeem = await req("/api/rewards/redeem", { method: "POST", token: other.token, body: { rewardId: "tk20" } });
  ok("not enough points -> 400", poorRedeem.status === 400);
  const red = await req("/api/rewards/redeem", { method: "POST", token: q.token, body: { rewardId: "tk50" } });
  ok("redeem creates a coupon + deducts points", red.status === 201 && /^RW[0-9A-F]{8}$/.test(red.data.code) && red.data.pointsLeft === 60, JSON.stringify(red.data));
  const own = await req("/api/coupons/validate", { method: "POST", token: q.token, body: { couponCode: red.data.code, orderAmount: 200 } });
  ok("owner can use the reward coupon", own.status === 200 && own.data.discountAmount === 50, JSON.stringify(own.data));
  ok("others can't use or see it", (await req("/api/coupons/validate", { method: "POST", token: other.token, body: { couponCode: red.data.code, orderAmount: 200 } })).status === 404 && !(await req("/api/coupons/available", { token: other.token })).data.coupons.some((x) => x.code === red.data.code));
  ok("reward coupon is private from the admin list too", !(await req("/api/coupons", { token: A })).data.coupons.some((x) => x.code === red.data.code));
  ok("coupon lists in my rewards", (await req("/api/rewards", { token: q.token })).data.coupons.some((x) => x.code === red.data.code));

  // ── 13. Budget tracker ────────────────────────────────────────────
  const bu = await mkUser("bu");
  ok("budget below ৳50 rejected", (await req("/api/budget", { method: "PUT", token: bu.token, body: { weeklyBudget: 10 } })).status === 400);
  const bset = await req("/api/budget", { method: "PUT", token: bu.token, body: { weeklyBudget: 200 } });
  ok("set a weekly budget", bset.data.limit === 200 && bset.data.spent === 0 && bset.data.daily.length === 7);
  const bo1 = await req("/api/orders", { method: "POST", token: bu.token, body: { items: [{ id: khichuri.id, qty: 3 }], paymentMethod: "cash" } }); // 180 = 90%
  ok("order response carries budget status", bo1.data.budget.spent === 180 && bo1.data.budget.percent === 90, JSON.stringify(bo1.data.budget));
  const bn = (await req("/api/notifications/history", { token: bu.token })).data.notifications;
  ok("crossing 80% sends a budget warning", bn.some((n) => /90%|80%/.test(n.message) && /budget/i.test(n.message)), JSON.stringify(bn.map((n) => n.message)));
  const bo2 = await req("/api/orders", { method: "POST", token: bu.token, body: { items: [{ id: khichuri.id, qty: 1 }], paymentMethod: "cash" } });
  ok("passing 100% sends an alert", (await req("/api/notifications/history", { token: bu.token })).data.notifications.some((n) => /passed your/.test(n.message)));
  const rep = (await req("/api/budget", { token: bu.token })).data;
  ok("report: spend by category + today's bar", rep.byCategory.heavy === 240 && rep.daily[6].spent === 240 && rep.remaining === -40, JSON.stringify(rep));
  await req(`/api/orders/${bo2.data.id}/cancel`, { method: "PATCH", token: bu.token });
  ok("cancelled unpaid orders stop counting", (await req("/api/budget", { token: bu.token })).data.spent === 180);
  ok("budget can be removed", (await req("/api/budget", { method: "PUT", token: bu.token, body: { weeklyBudget: null } })).data.limit === null);

  // ── 12. Cook plan / demand prediction ─────────────────────────────
  const target = ymd(new Date(dhaka().getTime() + 70 * 864e5)); // far enough that the 8-week lookback never touches today's real test orders
  const prev = (n) => ymd(new Date(Date.parse(`${target}T00:00:00Z`) - n * 864e5));
  const [hu] = await db.query("INSERT INTO users (name, external_id, role, password_hash, wallet_balance) VALUES ('Hist', ?, 'student', 'x', 0)", [`hist${stamp}`]);
  for (const day of [prev(7), prev(14)]) {
    const [oi] = await db.query("INSERT INTO orders (token, user_id, total, total_amount, meal_date, payment_method, status) VALUES (UUID(), ?, 600, 600, ?, 'cash', 'Ready')", [hu.insertId, day]);
    await db.query("INSERT INTO order_items (order_id, menu_item_id, name, price, qty, quantity) VALUES (?, ?, 'Khichuri', 60, 10, 10)", [oi.insertId, khichuri.id]);
  }
  const dem = (await req(`/api/admin/reports/demand?date=${target}`, { token: A })).data;
  const dk = dem.items.find((i) => i.name === "Khichuri");
  ok("cook plan: weekday average +10% margin", dem.basedOnDays === 2 && dem.confidence === "medium" && dk.expected === 10 && dk.recommended === 11, JSON.stringify([dem.basedOnDays, dk]));
  ok("cook plan: items nobody ordered stay at 0", dem.items.find((i) => i.name === "Cha (Tea)").recommended === 0);
  ok("cook plan accounts for pre-orders & stock", (await req("/api/admin/reports/demand", { token: A })).data.items.find((i) => i.name === "Khichuri").preOrdered >= 1 && typeof dk.toPrepare === "number");
  ok("cook plan is admin-only", (await req("/api/admin/reports/demand", { token: stu.token })).status === 403);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.pool.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH", e); process.exit(2); });

// notify-me.js — "Notify me" button on Sold-out items.
// Student taps 🔔 Notify me on a sold-out item. When the item is available again (admin adds stock / marks it
// available, or an order is cancelled and the stock comes back) the student gets a notification — live if they
// are online, or the next time they open the app if they were away.
// Run from the project main folder:  node notify-me.js   (then restart the backend)
const fs = require("fs");

const FILES = {
  html: "frontend/campusdine.html",
  server: "backend/server.js",
  menu: "backend/src/routes/menu.js",
  orders: "backend/src/routes/orders.js",
};
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) { console.error(`Run this from the project's main folder (${f} not found).`); process.exit(1); }
}
const ALERTS_FILE = "backend/src/stockAlerts.js";

const load = (file) => {
  const raw = fs.readFileSync(file, "utf8");
  return { file, crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") };
};
const docs = {};
for (const [k, f] of Object.entries(FILES)) docs[k] = load(f);

const MARK = {
  html: "/* Feature: notify me */",
  server: "stock_alerts",
  menu: "// Feature: notify me",
  orders: "pingWatchers",
};
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
const needAlertsFile = !fs.existsSync(ALERTS_FILE);
if (todo.length === 0 && !needAlertsFile) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/server.js: table ---------------- */
if (todo.includes("server")) {
  rep("server", "table",
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
`,
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
    await db.query(\`CREATE TABLE IF NOT EXISTS stock_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      menu_item_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_stock_alert (user_id, menu_item_id)
    )\`);   // "Notify me" requests for sold-out items
`);
}

/* ---------------- backend/src/routes/menu.js ---------------- */
if (todo.includes("menu")) {
  rep("menu", "import",
`const { loadItemRestaurants, saveItemRestaurant } = require("../restaurants");
`,
`const { loadItemRestaurants, saveItemRestaurant } = require("../restaurants");
const { pingWatchers } = require("../stockAlerts");
`);
  rep("menu", "ping after admin update",
`  if (io) io.emit("menu:changed"); // students' menus refresh live (sold out / hidden / price changes)
`,
`  if (io) io.emit("menu:changed"); // students' menus refresh live (sold out / hidden / price changes)
  try { await pingWatchers(io, [row[0].id]); } catch (e) { console.error("Notify-me ping failed:", e.message); }
`);
  rep("menu", "routes",
`module.exports = router;`,
`// Feature: notify me — students/teachers ask to be told when a sold-out item is available again
router.get("/alerts", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const [rows] = await pool.query(
    \`SELECT a.id, m.id AS item_id, m.name, m.stock, m.availability
     FROM stock_alerts a JOIN menu_items m ON m.id = a.menu_item_id
     WHERE a.user_id = ?\`, [req.user.id]);
  const isReady = (r) => Number(r.stock) > 0 && r.availability === "available";
  const ready = rows.filter(isReady);
  if (ready.length) {
    // these are delivered now, so they are removed
    await pool.query(\`DELETE FROM stock_alerts WHERE id IN (\${ready.map(() => "?").join(",")})\`, ready.map((r) => r.id));
  }
  res.json({
    watching: rows.filter((r) => !isReady(r)).map((r) => r.item_id),
    ready: ready.map((r) => ({ id: r.item_id, name: r.name })),
  });
}));

router.post("/:id/notify", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid item" });
  const [[item]] = await pool.query("SELECT id, stock, availability FROM menu_items WHERE id = ?", [id]);
  if (!item || item.availability === "hidden") return res.status(404).json({ error: "Item not found" });
  if (Number(item.stock) > 0 && item.availability === "available") {
    return res.status(409).json({ error: "This item is available right now — you can order it." });
  }
  await pool.query("INSERT IGNORE INTO stock_alerts (user_id, menu_item_id) VALUES (?, ?)", [req.user.id, id]);
  res.json({ ok: true });
}));

router.delete("/:id/notify", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  await pool.query("DELETE FROM stock_alerts WHERE user_id = ? AND menu_item_id = ?", [req.user.id, Number(req.params.id)]);
  res.json({ ok: true });
}));

module.exports = router;`);
}

/* ---------------- backend/src/routes/orders.js: cancelled order puts stock back ---------------- */
if (todo.includes("orders")) {
  rep("orders", "import",
`const { recordFraudEvent } = require("../utils/fraud");
`,
`const { recordFraudEvent } = require("../utils/fraud");
const { pingWatchers } = require("../stockAlerts");
`);
  rep("orders", "ping after cancel",
`    io.emit("queue:changed");

    res.json(updated);
  } catch (err) {`,
`    io.emit("queue:changed");
    try { await pingWatchers(io, items.map((i) => i.menu_item_id).filter(Boolean)); } catch (e) { console.error("Notify-me ping failed:", e.message); }

    res.json(updated);
  } catch (err) {`);
}

/* ---------------- frontend ---------------- */
if (todo.includes("html")) {
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "notify.me": "Notify me",
    "notify.on": "We'll notify you",
    "notify.set": "Done! We'll tell you as soon as it's back in stock.",
    "notify.back": "Back in stock",
    "notify.backmsg": "{n} is available again — order now!",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "notify.me": "আমাকে জানান",
    "notify.on": "জানানো হবে",
    "notify.set": "ঠিক আছে! আবার পাওয়া গেলেই আপনাকে জানাব।",
    "notify.back": "আবার পাওয়া যাচ্ছে",
    "notify.backmsg": "{n} আবার পাওয়া যাচ্ছে — এখনই অর্ডার করুন!",
`);

  // MenuOrder props + button
  rep("html", "MenuOrder props",
`function MenuOrder({ menu, cart, setCart, placeOrder, walletBalance, busy, onToggleFavorite, apiBase, sessionToken, loyaltyKey }) {`,
`function MenuOrder({ menu, cart, setCart, placeOrder, walletBalance, busy, onToggleFavorite, apiBase, sessionToken, loyaltyKey, watching = [], onToggleNotify }) {`);
  rep("html", "card opacity",
`className={\`card p-4 flex flex-col \${out ? "opacity-50" : ""}\`}`,
`className={\`card p-4 flex flex-col \${out ? "opacity-75" : ""}\`}`);
  rep("html", "notify button",
`                    <span className="text-xs font-600" style={{ color: "var(--brick)" }}>{item.availability === "sold_out" ? tx("soldout") : tx("outstock")}</span>`,
`                    <div className="flex items-center gap-2">
                      <span className="text-xs font-600" style={{ color: "var(--brick)" }}>{item.availability === "sold_out" ? tx("soldout") : tx("outstock")}</span>
                      {onToggleNotify && (
                        <button type="button" onClick={() => onToggleNotify(item.id)}
                          className="text-xs px-2.5 py-1 rounded-lg border font-600"
                          style={{ borderColor: "var(--line)", color: watching.includes(item.id) ? "var(--leaf)" : "var(--gold)" }}>
                          🔔 {watching.includes(item.id) ? tx("notify.on") : tx("notify.me")}
                        </button>
                      )}
                    </div>`);

  // App: state, helpers, socket
  rep("html", "state",
`const [wallet, setWallet] = useState({ balance: 0, transactions: [], loaded: false });
`,
`const [wallet, setWallet] = useState({ balance: 0, transactions: [], loaded: false });
  /* Feature: notify me */
  const [watching, setWatching] = useState([]);
`);
  rep("html", "helpers",
`const refreshWallet = async () => setWallet(mapWallet(await call("/api/wallet")));
`,
`const refreshWallet = async () => setWallet(mapWallet(await call("/api/wallet")));
  const refreshAlerts = async () => {
    const r = await call("/api/menu/alerts");
    setWatching(r.watching || []);
    for (const it of (r.ready || [])) pushNotification("stock", tx("notify.back"), tx("notify.backmsg", { n: it.name }));
    if ((r.ready || []).length) refreshMenu().catch(() => {});
  };
  const toggleNotify = async (itemId) => {
    try {
      if (watching.includes(itemId)) {
        await call("/api/menu/" + itemId + "/notify", { method: "DELETE" });
        setWatching(w => w.filter(id => id !== itemId));
      } else {
        await call("/api/menu/" + itemId + "/notify", { method: "POST" });
        setWatching(w => [...w, itemId]);
        showSuccess(tx("notify.set"));
      }
    } catch (e) { showError(e); refreshMenu().catch(() => {}); }
  };
`);
  rep("html", "socket connect",
`    socket.on("connect", () => {
      setConnected(true);
      if (session.user.role !== "admin" && session.user.role !== "rider") refreshMyOrders().catch(() => {});`,
`    socket.on("connect", () => {
      setConnected(true);
      if (session.user.role !== "admin" && session.user.role !== "rider") { refreshMyOrders().catch(() => {}); refreshAlerts().catch(() => {}); }`);
  rep("html", "socket restocked",
`    socket.on("menu:changed", () => { refreshMenu().catch(() => {}); });`,
`    socket.on("menu:changed", () => { refreshMenu().catch(() => {}); });
    socket.on("menu:restocked", () => { refreshAlerts().catch(() => {}); });`);
  rep("html", "pass props",
`sessionToken={session.token} loyaltyKey={loyaltyKey} />`,
`sessionToken={session.token} loyaltyKey={loyaltyKey} watching={watching} onToggleNotify={toggleNotify} />`);
}

/* ---------------- save ---------------- */
if (needAlertsFile) {
  fs.writeFileSync(ALERTS_FILE,
`// "Notify me" — tells students who asked about an item that it is available again.
// Sends a socket nudge to each waiting student; the app then fetches /api/menu/alerts and shows the notification.
const pool = require("./db");

async function pingWatchers(io, itemIds) {
  if (!io || !itemIds || itemIds.length === 0) return 0;
  const [rows] = await pool.query(
    \`SELECT DISTINCT a.user_id
     FROM stock_alerts a JOIN menu_items m ON m.id = a.menu_item_id
     WHERE a.menu_item_id IN (\${itemIds.map(() => "?").join(",")}) AND m.stock > 0 AND m.availability = 'available'\`,
    itemIds
  );
  for (const r of rows) io.to(\`user:\${r.user_id}\`).emit("menu:restocked");
  return rows.length;
}

module.exports = { pingWatchers };
`);
}
for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak13");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log('Done: "Notify me" added for sold-out items.');
console.log("Restart the backend now: Ctrl+C, then npm start. Then refresh the browser with Ctrl+Shift+R.");

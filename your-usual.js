// your-usual.js — "Your usual" on the Menu tab: the 3 items the student orders most, one tap to add to the cart.
// Built from the student's own past orders (cancelled orders don't count, sold-out items are skipped).
// Run from the project main folder:  node your-usual.js   (frontend only — no backend restart needed)
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) { console.error("Run this from the project's main folder (frontend/campusdine.html not found)."); process.exit(1); }

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Feature: your usual */")) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`); process.exit(1); }
  s = s.replace(from, () => to);
}

// texts
rep("en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "usual.title": "Your usual",
    "usual.times": "Ordered {n} time(s)",
`);
rep("bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "usual.title": "আপনার নিয়মিত পছন্দ",
    "usual.times": "{n} বার অর্ডার করেছেন",
`);

// the panel
rep("component",
`function FavoritesQuickOrderPanel({ items, cart, add, onToggleFavorite, setFavoritesOnly }) {`,
`/* Feature: your usual */
// the (up to) 3 menu items this student has ordered in the most separate orders; unavailable items are skipped
function pickUsual(pastOrders, menu) {
  const counts = new Map();
  for (const o of pastOrders || []) {
    if (o.status === "Cancelled") continue;
    for (const name of new Set((o.items || []).map(i => i.name))) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ item: menu.find(m => m.name === name), n }))
    .filter(x => x.item && x.item.availability === "available" && Number(x.item.stock) > 0)
    .slice(0, 3);
}
function UsualPanel({ pastOrders, menu, cart, add }) {
  const usual = pickUsual(pastOrders, menu);
  if (usual.length === 0) return null;
  return (
    <div className="mb-5 rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="font-display font-700 text-base mb-3" style={{ color: "var(--gold)" }}>🔁 {tx("usual.title")}</div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {usual.map(({ item, n }) => {
          const inCart = cart.find(c => c.id === item.id);
          const maxed = !!inCart && inCart.qty >= item.stock;
          return (
            <div key={"usual-" + item.id} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--panel-soft)" }}>
              <div className="flex items-center gap-1.5">
                <DietMark isVeg={!!item.is_veg} />
                <span className="font-600 text-sm" style={{ color: "var(--ink)" }}>{itemName(item)}</span>
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>{tx("usual.times", { n: num(n) })}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono font-600 text-sm">{taka(item.price)}</span>
                <button type="button" disabled={maxed} onClick={() => add(item)}
                  className="text-xs px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: inCart ? "var(--teal)" : "var(--gold)" }}>
                  {inCart ? tx("plus1") : tx("add")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function FavoritesQuickOrderPanel({ items, cart, add, onToggleFavorite, setFavoritesOnly }) {`);

// show it above "Starred Items"
rep("render",
`        <FavoritesQuickOrderPanel items={starredItems} cart={cart} add={add}`,
`        <UsualPanel pastOrders={pastOrders} menu={menu} cart={cart} add={add} />
        <FavoritesQuickOrderPanel items={starredItems} cart={cart} add={add}`);

// MenuOrder receives the past orders
rep("prop",
`function MenuOrder({ menu, cart, setCart,`,
`function MenuOrder({ pastOrders = [], menu, cart, setCart,`);
rep("pass prop",
`sessionToken={session.token} loyaltyKey={loyaltyKey}`,
`sessionToken={session.token} loyaltyKey={loyaltyKey} pastOrders={orders}`);

fs.copyFileSync(FILE, FILE + ".bak18");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log('Done: "Your usual" added to the Menu tab.');

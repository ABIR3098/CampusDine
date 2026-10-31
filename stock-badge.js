// stock-badge.js — Stock badges.
//  Students: a "SOLD OUT" badge on the food photo when stock is 0 (or the admin marked it sold out),
//            and an "Only N left" badge when 5 or fewer are left.
//  Admin:    the status pill no longer says "Available" when stock is 0 — it says "Sold out (stock 0)"
//            automatically, and "Low stock" when stock is 10 or fewer.
// The server already refuses orders for items without stock; this only makes it visible.
// Run from the project main folder:  node stock-badge.js   (frontend only, no backend restart needed)
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) {
  console.error("Run this from the project's main folder (frontend/campusdine.html not found).");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Feature: stock badges */")) {
  console.log("Already applied — nothing to do.");
  process.exit(0);
}

function rep(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`); process.exit(1); }
  s = s.replace(from, () => to);
}

// constant
rep("constant",
`const LOW_STOCK_THRESHOLD = 10;
`,
`const LOW_STOCK_THRESHOLD = 10;
const STUDENT_LOW_STOCK = 5; /* Feature: stock badges */ // students see "Only N left" at or below this
`);

// texts
rep("en text",
`    "soldout": "Sold out"
  },`,
`    "soldout": "Sold out",
    "onlyleft": "Only {n} left"
  },`);
rep("bn text",
`    "soldout": "বিক্রি শেষ"
  }
};`,
`    "soldout": "বিক্রি শেষ",
    "onlyleft": "মাত্র {n}টি বাকি"
  }
};`);

// student menu: badge on the photo
rep("photo box",
`style={{ margin: "-1rem -1rem 0.75rem", height: 150,`,
`style={{ position: "relative", margin: "-1rem -1rem 0.75rem", height: 150,`);
rep("badge",
`                  <img src={(apiBase || "") + (item.image || "/images/food/default.svg")} alt={item.name} loading="lazy"`,
`                  {(out || (Number(item.stock) > 0 && Number(item.stock) <= STUDENT_LOW_STOCK)) && (
                    <span className="absolute top-2 left-2 text-[11px] font-700 px-2.5 py-1 rounded-full"
                      style={{ background: out ? "#B91C1C" : "#F59E0B", color: "#FFFFFF", zIndex: 1 }}>
                      {out ? tx("soldout") : tx("onlyleft", { n: num(item.stock) })}
                    </span>
                  )}
                  <img src={(apiBase || "") + (item.image || "/images/food/default.svg")} alt={item.name} loading="lazy"`);

// admin: automatic Sold out / Low stock pill
rep("admin pill",
`                    const pill = a === "hidden" ? "Hidden" : a === "sold_out" ? "Sold out" : "Available";
                    const pillStyle = a === "available"
                      ? { background: "var(--ok-bg, #F0FDF4)", color: "var(--ok-fg, #15803D)" }
                      : a === "sold_out"
                        ? { background: "var(--warn-bg, #FFFBEB)", color: "var(--warn-fg, #92400E)" }
                        : { background: "var(--danger-bg, #FEF2F2)", color: "var(--danger-fg, #B91C1C)" };`,
`                    const stockNum = Number(item.stock);
                    const autoOut = a === "available" && stockNum <= 0;
                    const lowStock = a === "available" && stockNum > 0 && stockNum <= LOW_STOCK_THRESHOLD;
                    const pill = a === "hidden" ? "Hidden" : a === "sold_out" ? "Sold out" : autoOut ? "Sold out (stock 0)" : lowStock ? "Low stock · " + stockNum + " left" : "Available";
                    const pillStyle = autoOut
                      ? { background: "var(--danger-bg, #FEF2F2)", color: "var(--danger-fg, #B91C1C)" }
                      : lowStock || a === "sold_out"
                        ? { background: "var(--warn-bg, #FFFBEB)", color: "var(--warn-fg, #92400E)" }
                        : a === "available"
                          ? { background: "var(--ok-bg, #F0FDF4)", color: "var(--ok-fg, #15803D)" }
                          : { background: "var(--danger-bg, #FEF2F2)", color: "var(--danger-fg, #B91C1C)" };`);

fs.copyFileSync(FILE, FILE + ".bak12");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: stock badges added (student menu + admin menu manager).");

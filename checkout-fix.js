// checkout-fix.js — "Checkout" button no longer stays grey forever when the price preview fails.
// Run from the project main folder:  node checkout-fix.js
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) {
  console.error("Run this from the project's main folder (frontend/campusdine.html not found).");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Fix: checkout works even if price preview fails */")) {
  console.log("Already applied — nothing to do.");
  process.exit(0);
}

function replaceOnce(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) {
    console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`);
    process.exit(1);
  }
  s = s.replace(from, () => to);
}

// 1) remember WHY the preview failed
replaceOnce("state",
`  const [quote, setQuote] = useState(null);
`,
`  const [quote, setQuote] = useState(null);
  /* Fix: checkout works even if price preview fails */
  const [quoteError, setQuoteError] = useState("");
`);

// 2) clear the error on success, store it on failure
replaceOnce("then",
`.then(q => { if (!dead) { setQuote(q); if (q.rewardError) setRewardId(null); } })`,
`.then(q => { if (!dead) { setQuote(q); setQuoteError(""); if (q.rewardError) setRewardId(null); } })`);
replaceOnce("catch",
`.catch(() => { if (!dead) setQuote(null); });`,
`.catch((e) => { if (!dead) { setQuote(null); setQuoteError((e && e.message) || "Price preview unavailable"); } });`);

// 3) show the reason + only wait while the preview is still loading
replaceOnce("button",
`              <button disabled={!canCheckout || busy || !quote} onClick={() => placeOrder(`,
`              {!quote && quoteError && (
                <p className="text-xs mb-3" style={{ color: "var(--brick)" }}>
                  Price preview unavailable ({quoteError}). The final price is calculated when you place the order.
                </p>
              )}
              <button disabled={!canCheckout || busy || (!quote && !quoteError)} onClick={() => placeOrder(`);

fs.copyFileSync(FILE, FILE + ".bak7");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: checkout button now works even if the price preview fails.");

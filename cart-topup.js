// cart-topup.js — Cart: when the wallet balance is too low, show "You need ৳X more" and a Top up button.
// The button opens the Wallet tab with the top-up amount already filled in (the missing amount, rounded up to ৳10).
// Run from the project main folder:  node cart-topup.js   (frontend only — no backend restart needed)
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) { console.error("Run this from the project's main folder (frontend/campusdine.html not found)."); process.exit(1); }

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Feature: cart top-up shortcut */")) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`); process.exit(1); }
  s = s.replace(from, () => to);
}

// does the cart charge a rider tip as well? (then the missing amount includes it)
const withTip = s.includes("const [tip, setTip] = useState(0);");
const SHORT = withTip ? "Math.max(0, total + tip - walletBalance)" : "Math.max(0, total - walletBalance)";

// texts
rep("en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "topup.short": "You need {a} more",
`);
rep("bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "topup.short": "আরও {a} দরকার",
`);

// Wallet tab starts with the suggested amount
rep("wallet signature",
`function WalletTab({ balance, topUp, transactions, busy, onLookup, onSend }) {`,
`function WalletTab({ balance, topUp, transactions, busy, onLookup, onSend, suggestedAmount }) {`);
rep("wallet amount",
`const [amount, setAmount] = useState(100);`,
`const [amount, setAmount] = useState(suggestedAmount || 100);`);
rep("wallet usage",
`<WalletTab balance={wallet.balance} topUp={topUp} transactions={wallet.transactions} busy={busy}`,
`<WalletTab balance={wallet.balance} topUp={topUp} transactions={wallet.transactions} busy={busy} suggestedAmount={topupSuggest}`);

// App: remember the suggestion, go to the Wallet tab
rep("app handler",
`const placeOrder = async (`,
`/* Feature: cart top-up shortcut */
  const [topupSuggest, setTopupSuggest] = useState(null);
  useEffect(() => { if (tab !== "wallet") setTopupSuggest(null); }, [tab]);
  const goTopUp = (shortage) => {
    setTopupSuggest(Math.min(10000, Math.max(10, Math.ceil(shortage / 10) * 10))); // rounded up to ৳10, within the ৳10,000 limit
    setTab("wallet");
  };

  const placeOrder = async (`);

// Menu: new prop + the button
rep("menu prop",
`function MenuOrder({`,
`function MenuOrder({ onTopUp,`);
rep("pass prop",
`sessionToken={session.token} loyaltyKey={loyaltyKey}`,
`sessionToken={session.token} loyaltyKey={loyaltyKey} onTopUp={goTopUp}`);
rep("message",
`                <p className="text-xs mb-3" style={{ color: "var(--brick)" }}>{tx("insufficient")}</p>`,
`                <div className="mb-3">
                  <p className="text-xs" style={{ color: "var(--brick)" }}>{tx("insufficient")}</p>
                  {onTopUp && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-600">{tx("topup.short", { a: taka(${SHORT}) })}</span>
                      <button type="button" onClick={() => onTopUp(${SHORT})} className="btn-primary text-xs px-3 py-1.5 rounded-lg">{tx("topup")}</button>
                    </div>
                  )}
                </div>`);

fs.copyFileSync(FILE, FILE + ".bak21");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: Top up shortcut added to the cart.");

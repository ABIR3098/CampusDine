// profile-balance-fix.js — Profile balance and Wallet balance always show the same amount
// Run from the project main folder:  node profile-balance-fix.js
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) {
  console.error("Run this from the project's main folder (frontend/campusdine.html not found).");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Fix: profile balance = live wallet balance */")) {
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

// 1) ProfileTab accepts the live balance
replaceOnce("signature",
`function ProfileTab({ user, call, onUpdated }) {`,
`function ProfileTab({ user, call, onUpdated, liveBalance }) {`);

// 2) one shown balance: the live wallet balance when we have it, else the profile's own copy
replaceOnce("shown balance",
`  const [walletBalance, setWalletBalance] = useState(user.walletBalance);
`,
`  const [walletBalance, setWalletBalance] = useState(user.walletBalance);
  /* Fix: profile balance = live wallet balance */
  const shownBalance = liveBalance != null ? liveBalance : walletBalance;
`);

// 3) display it
replaceOnce("display",
`<div className="font-mono text-xl font-700">{taka(walletBalance)}</div>`,
`<div className="font-mono text-xl font-700">{taka(shownBalance)}</div>`);

// 4) pass the live balance from the App
replaceOnce("pass prop",
`<ProfileTab user={session.user} call={call}`,
`<ProfileTab user={session.user} call={call} liveBalance={session.user.role !== "admin" && wallet.loaded ? wallet.balance : null}`);

// 5) re-fetch the wallet whenever the Wallet or Profile tab is opened
replaceOnce("refresh on tab open",
`  const placeOrder = async (`,
`  useEffect(() => {
    if (session && session.user.role !== "admin" && (tab === "wallet" || tab === "profile")) refreshWallet().catch(() => {});
  }, [tab]);

  const placeOrder = async (`);

fs.copyFileSync(FILE, FILE + ".bak6");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: profile balance now always matches the wallet balance.");

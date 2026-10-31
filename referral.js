// referral.js — Feature: referral code.
//  • Every student/teacher gets a personal code (e.g. CD7K2PQ) on the Wallet tab, with a Copy button.
//  • A new user can type a friend's code on the Sign-up form (optional).
//  • When the new user's FIRST order is handed over (collected), BOTH get ৳20 in their wallet.
//    (Needs a real order, so fake accounts don't earn anything. A friend can use one code once;
//     one person can earn the bonus for at most 10 friends.)
// Run from the project main folder:  node referral.js   (then restart the backend)
const fs = require("fs");

const FILES = {
  html: "frontend/campusdine.html",
  server: "backend/server.js",
  auth: "backend/src/routes/auth.js",
  orders: "backend/src/routes/orders.js",
  wallet: "backend/src/routes/wallet.js",
};
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) { console.error(`Run this from the project's main folder (${f} not found).`); process.exit(1); }
}
const HELPER = "backend/src/referrals.js";
const load = (file) => {
  const raw = fs.readFileSync(file, "utf8");
  return { file, crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") };
};
const docs = {};
for (const [k, f] of Object.entries(FILES)) docs[k] = load(f);

const MARK = {
  html: "/* Feature: referral code */",
  server: "referral_code",
  auth: "// Feature: referral code",
  orders: "rewardReferral",
  wallet: "// Feature: referral code",
};
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
const needHelper = !fs.existsSync(HELPER);
if (todo.length === 0 && !needHelper) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/server.js: columns ---------------- */
if (todo.includes("server")) {
  rep("server", "columns",
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
`,
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
    await addColumn("users", "referral_code", "VARCHAR(12) NULL");       // this user's own code
    await addColumn("users", "referred_by", "INT NULL");                  // whose code they signed up with
    await addColumn("users", "referral_rewarded_at", "DATETIME NULL");    // when the bonus was paid (only once)
    try { await db.query("ALTER TABLE users ADD UNIQUE KEY uq_referral_code (referral_code)"); } catch (_) { /* already there */ }
`);
}

/* ---------------- backend/src/routes/auth.js: accept a code at sign-up ---------------- */
if (todo.includes("auth")) {
  rep("auth", "lookup",
`  // Email must be proven with the 6-digit code that /otp/send-signup mailed (body.otp)
`,
`  // Feature: referral code — optional; checked before the email code is used up, so a typo doesn't waste it
  let referrerId = null;
  const referralCode = clean(req.body.referralCode).toUpperCase();
  if (referralCode && role !== "rider") {
    const [refRows] = await pool.query("SELECT id FROM users WHERE referral_code = ? AND role IN ('student', 'teacher')", [referralCode]);
    if (refRows.length === 0) return res.status(400).json({ error: "That referral code was not found — check it, or leave it empty", code: "REFERRAL_INVALID" });
    referrerId = refRows[0].id;
  }

  // Email must be proven with the 6-digit code that /otp/send-signup mailed (body.otp)
`);
  rep("auth", "save",
`    if (startingBalance > 0) {
`,
`    if (referrerId) await conn.query("UPDATE users SET referred_by = ? WHERE id = ?", [referrerId, userId]);
    if (startingBalance > 0) {
`);
}

/* ---------------- backend/src/routes/orders.js: pay the bonus at the first handover ---------------- */
if (todo.includes("orders")) {
  rep("orders", "import",
`const { recordFraudEvent } = require("../utils/fraud");
`,
`const { recordFraudEvent } = require("../utils/fraud");
const { rewardReferral } = require("../referrals");
`);
  rep("orders", "variable",
`    let pickedUpAt;
`,
`    let pickedUpAt;
    let referralResult = null;
`);
  rep("orders", "reward",
`      pickedUpAt = fresh.picked_up_at;
      await connection.commit();`,
`      pickedUpAt = fresh.picked_up_at;
      referralResult = await rewardReferral(connection, order.user_id); // Feature: referral code (never blocks the pickup)
      await connection.commit();`);
  rep("orders", "notify",
`    const done = { ...order, picked_up_at: pickedUpAt, items };
`,
`    const done = { ...order, picked_up_at: pickedUpAt, items };
    if (referralResult) {
      const ioRef = req.app.get("io");
      ioRef.to(\`user:\${referralResult.userId}\`).emit("referral:bonus", { amount: referralResult.amount, kind: "friend" });
      if (referralResult.referrerPaid) ioRef.to(\`user:\${referralResult.referrerId}\`).emit("referral:bonus", { amount: referralResult.amount, kind: "referrer" });
    }
`);
}

/* ---------------- backend/src/routes/wallet.js: "my code" endpoint ---------------- */
if (todo.includes("wallet")) {
  rep("wallet", "import",
`const catchAsync = require("../utils/catchAsync");
`,
`const catchAsync = require("../utils/catchAsync");
const { ensureCode, REFERRAL_BONUS, MAX_REWARDS_PER_REFERRER } = require("../referrals");
`);
  rep("wallet", "route",
`module.exports = router;`,
`// Feature: referral code — GET /api/wallet/referral: my code and how it is doing
router.get("/referral", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const code = await ensureCode(pool, req.user.id);
  const [[st]] = await pool.query(
    "SELECT COUNT(*) AS invited, COALESCE(SUM(referral_rewarded_at IS NOT NULL), 0) AS rewarded FROM users WHERE referred_by = ?", [req.user.id]);
  const rewarded = Number(st.rewarded);
  res.json({
    code, bonus: REFERRAL_BONUS, maxRewards: MAX_REWARDS_PER_REFERRER,
    invited: Number(st.invited), rewarded, earned: Math.min(rewarded, MAX_REWARDS_PER_REFERRER) * REFERRAL_BONUS,
  });
}));

module.exports = router;`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "ref.label": "Referral code (optional)",
    "ref.ph": "e.g. CD7K2PQ",
    "ref.hint": "A friend's code — you both get a wallet bonus after your first order.",
    "ref.title": "Invite friends",
    "ref.yours": "Your code",
    "ref.copy": "Copy",
    "ref.copied": "Copied!",
    "ref.how": "Share your code. When a friend signs up with it and their first order is collected, you both get {b}.",
    "ref.stats": "{i} joined · {r} ordered · you earned {e}",
    "ref.got.friend": "Welcome gift: {a} from your friend's referral code!",
    "ref.got.referrer": "A friend you invited got their first order — you earned {a}!",
    "ref.got.t": "Referral bonus",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "ref.label": "রেফারেল কোড (ঐচ্ছিক)",
    "ref.ph": "যেমন CD7K2PQ",
    "ref.hint": "বন্ধুর কোড — প্রথম অর্ডারের পর দুজনেই ওয়ালেটে বোনাস পাবেন।",
    "ref.title": "বন্ধুদের আমন্ত্রণ জানান",
    "ref.yours": "আপনার কোড",
    "ref.copy": "কপি",
    "ref.copied": "কপি হয়েছে!",
    "ref.how": "আপনার কোড শেয়ার করুন। বন্ধু এই কোড দিয়ে সাইন আপ করে প্রথম অর্ডার নিলে দুজনেই {b} পাবেন।",
    "ref.stats": "{i} জন যোগ দিয়েছেন · {r} জন অর্ডার করেছেন · আপনি পেয়েছেন {e}",
    "ref.got.friend": "স্বাগতম উপহার: বন্ধুর রেফারেল কোড থেকে {a}!",
    "ref.got.referrer": "আপনার আমন্ত্রিত বন্ধু প্রথম অর্ডার নিয়েছেন — আপনি পেলেন {a}!",
    "ref.got.t": "রেফারেল বোনাস",
`);

  // sign-up form: state, field, request body
  rep("html", "signup state",
`  const [roomNumber, setRoomNumber] = useState("");
`,
`  const [roomNumber, setRoomNumber] = useState("");
  /* Feature: referral code */
  const [referralCode, setReferralCode] = useState("");
`);
  rep("html", "signup body",
`            otp: otpRequired ? otp.trim() : undefined,
          } });`,
`            otp: otpRequired ? otp.trim() : undefined,
            referralCode: referralCode.trim() || undefined,
          } });`);
  rep("html", "signup field",
`                  <div>
                    <label className="text-xs uppercase tracking-wide block mb-1.5" style={{ color: "var(--ink-soft)" }}>{tx("pw")}</label>`,
`                  {mode === "register" && role !== "rider" && (
                    <div>
                      <label className="text-xs uppercase tracking-wide block mb-1.5" style={{ color: "var(--ink-soft)" }}>{tx("ref.label")}</label>
                      <input value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} placeholder={tx("ref.ph")}
                        className="w-full px-4 py-2.5 rounded-xl border font-mono" style={{ borderColor: "var(--line)" }} />
                      <p className="text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>{tx("ref.hint")}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs uppercase tracking-wide block mb-1.5" style={{ color: "var(--ink-soft)" }}>{tx("pw")}</label>`);

  // wallet tab: the card
  rep("html", "card component",
`function WalletTab({ balance, topUp,`,
`function ReferralCard({ apiBase, token }) {
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let dead = false;
    api(apiBase, "/api/wallet/referral", { token }).then(d => { if (!dead) setInfo(d); }).catch(() => {});
    return () => { dead = true; };
  }, []);
  if (!info) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(info.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (_) { window.prompt(tx("ref.copy") + ":", info.code); }
  };
  return (
    <div className="card p-5 mb-5">
      <div className="font-display font-700 mb-2" style={{ color: "var(--gold)" }}>🎁 {tx("ref.title")}</div>
      <div className="text-xs mb-1" style={{ color: "var(--ink-soft)" }}>{tx("ref.yours")}</div>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-xl font-700 tracking-widest px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--panel-soft)" }}>{info.code}</span>
        <button type="button" onClick={copy} className="text-xs px-3 py-1.5 rounded-lg border font-600" style={{ borderColor: "var(--line)", color: copied ? "var(--leaf)" : "var(--ink-soft)" }}>
          {copied ? "✓ " + tx("ref.copied") : "📋 " + tx("ref.copy")}
        </button>
      </div>
      <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>{tx("ref.how", { b: taka(info.bonus) })}</p>
      <p className="text-xs font-600">{tx("ref.stats", { i: num(info.invited), r: num(info.rewarded), e: taka(info.earned) })}</p>
    </div>
  );
}
function WalletTab({ apiBase, token, balance, topUp,`);
  rep("html", "card placement",
`        <div className="card p-5">
          <div className="font-display font-700 mb-3" style={{ color: "var(--gold)" }}>{tx("topup")}</div>`,
`        <ReferralCard apiBase={apiBase} token={token} />
        <div className="card p-5">
          <div className="font-display font-700 mb-3" style={{ color: "var(--gold)" }}>{tx("topup")}</div>`);
  rep("html", "wallet usage",
`<WalletTab balance={wallet.balance}`,
`<WalletTab apiBase={apiBase} token={session.token} balance={wallet.balance}`);

  // live bonus notification
  rep("html", "socket",
`    socket.on("disconnect", () => setConnected(false));
`,
`    socket.on("disconnect", () => setConnected(false));
    socket.on("referral:bonus", (p) => {
      refreshWallet().catch(() => {});
      pushNotification("wallet", tx("ref.got.t"), tx(p.kind === "referrer" ? "ref.got.referrer" : "ref.got.friend", { a: taka(p.amount) }));
    });
`);
}

/* ---------------- save ---------------- */
if (needHelper) {
  fs.writeFileSync(HELPER,
`// Referral codes: each student/teacher has a code; a friend who signs up with it and gets their first order
// collected earns both of them a wallet bonus.
const crypto = require("crypto");

const REFERRAL_BONUS = 20;            // taka, for each of the two people
const MAX_REWARDS_PER_REFERRER = 10;  // after 10 rewarded friends the referrer is not paid again (the friend still is)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I so codes are easy to read out

function randomCode() {
  return "CD" + [...crypto.randomBytes(5)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

// The user's own code; created the first time it is asked for.
async function ensureCode(pool, userId) {
  const [[u]] = await pool.query("SELECT referral_code FROM users WHERE id = ?", [userId]);
  if (u && u.referral_code) return u.referral_code;
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    try {
      const [r] = await pool.query("UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL", [code, userId]);
      if (r.affectedRows) return code;
      const [[again]] = await pool.query("SELECT referral_code FROM users WHERE id = ?", [userId]);
      return again.referral_code;
    } catch (e) {
      if (e.code !== "ER_DUP_ENTRY") throw e; // somebody already has this code: try another
    }
  }
  throw new Error("Could not create a referral code");
}

// Called inside the pickup transaction. Pays once, on the referred user's first collected order.
// A savepoint keeps a failure here from ever blocking the pickup itself.
async function rewardReferral(conn, userId) {
  await conn.query("SAVEPOINT referral_reward");
  try {
    const [[u]] = await conn.query("SELECT id, name, referred_by, referral_rewarded_at FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!u || !u.referred_by || u.referral_rewarded_at) { await conn.query("RELEASE SAVEPOINT referral_reward"); return null; }

    const [[cnt]] = await conn.query("SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_rewarded_at IS NOT NULL", [u.referred_by]);
    const referrerPaid = Number(cnt.n) < MAX_REWARDS_PER_REFERRER;

    await conn.query("UPDATE users SET referral_rewarded_at = NOW(), wallet_balance = wallet_balance + ? WHERE id = ?", [REFERRAL_BONUS, u.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)",
      [u.id, "Referral bonus — welcome gift from a friend's code", REFERRAL_BONUS]);
    if (referrerPaid) {
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [REFERRAL_BONUS, u.referred_by]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)",
        [u.referred_by, \`Referral bonus — \${String(u.name).split(" ")[0]} placed their first order\`, REFERRAL_BONUS]);
    }
    await conn.query("RELEASE SAVEPOINT referral_reward");
    return { userId: u.id, referrerId: u.referred_by, amount: REFERRAL_BONUS, referrerPaid };
  } catch (e) {
    await conn.query("ROLLBACK TO SAVEPOINT referral_reward").catch(() => {});
    console.error("Referral reward failed:", e.message);
    return null;
  }
}

module.exports = { ensureCode, rewardReferral, REFERRAL_BONUS, MAX_REWARDS_PER_REFERRER };
`);
}
for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak23");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: referral codes added (sign-up field, Wallet-tab card, bonus at the first collected order).");
console.log("Restart the backend now: Ctrl+C, then cd backend, npm start. Then refresh the browser with Ctrl+Shift+R.");

#!/usr/bin/env node
/*
 * apply-theme.js — adds to CampusDine's frontend/campusdine.html:
 *   1) THEME: Light / Dark / Auto mode + 5 accent colours (green, blue, orange, purple, rose),
 *      a 🎨 button on the login page and in the top bar, remembered in the browser.
 *   2) LOW-BALANCE ALERT: when a student's/teacher's wallet is below ৳50 a yellow banner
 *      appears with a one-click "Top up" button (hidden on the Wallet tab, can be dismissed).
 *   3) Bangla + English text for everything above.
 *
 * Usage (from the project root, the folder that contains "frontend"):
 *     node apply-theme.js                      -> edits frontend/campusdine.html
 *     node apply-theme.js path/to/campusdine.html
 *
 * Safe by design: it makes a backup first, refuses to run twice, and if ANY expected piece of
 * code is not found it changes nothing and tells you which one.
 */
const fs = require("fs");
const path = require("path");

const target = path.resolve(process.argv[2] || path.join("frontend", "campusdine.html"));
if (!fs.existsSync(target)) {
  console.error("Cannot find " + target + "\nRun this from the project root (the folder containing 'frontend'), or pass the file path.");
  process.exit(1);
}

const PAIRS = [
 {
  "old": "  :root{\n    --bg: #F5F7FA;\n    --panel: #FFFFFF;\n    --ink: #1F2937;\n    --ink-soft: #6B7280;\n    --teal: #16A34A;\n    --teal-deep: #14532D;\n    --gold: #16A34A;\n    --gold-bright: #15803D;\n    --gold-deep: #15803D;\n    --gold-soft: #DCFCE7;\n    --brick: #DC2626;\n    --leaf: #16A34A;\n    --line: #E5E7EB;\n  }",
  "new": "  /* ---- Theme: light is the default; <html data-theme=\"dark\"> and data-accent=\"blue|orange|purple|rose\" override it ---- */\n  :root{\n    --bg: #F5F7FA;\n    --panel: #FFFFFF;\n    --ink: #1F2937;\n    --ink-soft: #6B7280;\n    --line: #E5E7EB;\n    --panel-glass: rgba(255,255,255,0.92);\n    --panel-soft: rgba(255,255,255,0.6);\n    --input-bg: #FFFFFF;\n    --hover: rgba(0,0,0,0.05);\n    --scroll: #D1D5DB;\n    --disabled-bg: #D1D5DB; --disabled-fg: #9CA3AF; --disabled-soft: #F3F4F6;\n    --danger-bg: #FEF2F2; --danger-fg: #B91C1C; --danger-border: #FECACA;\n    --ok-bg: #F0FDF4; --ok-fg: #15803D; --ok-border: #BBF7D0;\n    --warn-bg: #FFFBEB; --warn-fg: #92400E; --warn-border: #FDE68A;\n    --brick: #DC2626;\n    --leaf: #16A34A;\n    /* accent colour (green by default) */\n    --teal: #16A34A;\n    --gold: #16A34A;\n    --gold-bright: #15803D;\n    --gold-deep: #15803D;\n    --gold-hover: #15803D;\n    --teal-deep: #14532D;\n    --gold-soft: #DCFCE7;\n    --accent-border: #BBF7D0;\n    --accent-glow: rgba(22,163,74,0.18);\n    --accent-shadow: rgba(21,128,61,0.6);\n  }\n  html[data-accent=\"blue\"]  { --teal:#2563EB; --gold:#2563EB; --gold-bright:#1D4ED8; --gold-deep:#1D4ED8; --gold-hover:#1D4ED8; --teal-deep:#1E3A8A; --gold-soft:#DBEAFE; --accent-border:#BFDBFE; --accent-glow:rgba(37,99,235,0.18);  --accent-shadow:rgba(29,78,216,0.6); }\n  html[data-accent=\"orange\"]{ --teal:#EA580C; --gold:#EA580C; --gold-bright:#C2410C; --gold-deep:#C2410C; --gold-hover:#C2410C; --teal-deep:#7C2D12; --gold-soft:#FFEDD5; --accent-border:#FED7AA; --accent-glow:rgba(234,88,12,0.18);  --accent-shadow:rgba(194,65,12,0.6); }\n  html[data-accent=\"purple\"]{ --teal:#7C3AED; --gold:#7C3AED; --gold-bright:#6D28D9; --gold-deep:#6D28D9; --gold-hover:#6D28D9; --teal-deep:#4C1D95; --gold-soft:#EDE9FE; --accent-border:#DDD6FE; --accent-glow:rgba(124,58,237,0.18); --accent-shadow:rgba(109,40,217,0.6); }\n  html[data-accent=\"rose\"]  { --teal:#E11D48; --gold:#E11D48; --gold-bright:#BE123C; --gold-deep:#BE123C; --gold-hover:#BE123C; --teal-deep:#881337; --gold-soft:#FFE4E6; --accent-border:#FECDD3; --accent-glow:rgba(225,29,72,0.18);  --accent-shadow:rgba(190,18,60,0.6); }\n\n  html[data-theme=\"dark\"]{\n    color-scheme: dark;\n    --bg: #0B1220;\n    --panel: #111A2B;\n    --ink: #E5E7EB;\n    --ink-soft: #9AA4B2;\n    --line: #243044;\n    --panel-glass: rgba(11,18,32,0.9);\n    --panel-soft: rgba(255,255,255,0.04);\n    --input-bg: #0D1626;\n    --hover: rgba(255,255,255,0.08);\n    --scroll: #334155;\n    --disabled-bg: #263244; --disabled-fg: #6B7280; --disabled-soft: #1A2436;\n    --danger-bg: #2A1215; --danger-fg: #FCA5A5; --danger-border: #5B1F24;\n    --ok-bg: #0F2A1B; --ok-fg: #86EFAC; --ok-border: #1F5130;\n    --warn-bg: #2A210A; --warn-fg: #FCD34D; --warn-border: #5C4510;\n    --brick: #EF4444;\n    --gold-bright: #4ADE80; --gold-deep: #4ADE80; --gold-hover: #15803D;\n    --teal-deep: #86EFAC; --gold-soft: #0F2A1B; --accent-border: #1F5130;\n    --accent-glow: rgba(34,197,94,0.25); --accent-shadow: rgba(0,0,0,0.5);\n  }\n  html[data-theme=\"dark\"][data-accent=\"blue\"]  { --teal:#3B82F6; --gold:#3B82F6; --gold-bright:#60A5FA; --gold-deep:#60A5FA; --gold-hover:#2563EB; --teal-deep:#93C5FD; --gold-soft:#10234A; --accent-border:#1E3A8A; --accent-glow:rgba(59,130,246,0.25); }\n  html[data-theme=\"dark\"][data-accent=\"orange\"]{ --teal:#EA580C; --gold:#EA580C; --gold-bright:#FB923C; --gold-deep:#FB923C; --gold-hover:#C2410C; --teal-deep:#FDBA74; --gold-soft:#3A1D0B; --accent-border:#7C2D12; --accent-glow:rgba(234,88,12,0.25); }\n  html[data-theme=\"dark\"][data-accent=\"purple\"]{ --teal:#8B5CF6; --gold:#8B5CF6; --gold-bright:#A78BFA; --gold-deep:#A78BFA; --gold-hover:#7C3AED; --teal-deep:#C4B5FD; --gold-soft:#25164A; --accent-border:#4C1D95; --accent-glow:rgba(139,92,246,0.25); }\n  html[data-theme=\"dark\"][data-accent=\"rose\"]  { --teal:#F43F5E; --gold:#F43F5E; --gold-bright:#FB7185; --gold-deep:#FB7185; --gold-hover:#E11D48; --teal-deep:#FDA4AF; --gold-soft:#3A0F1B; --accent-border:#881337; --accent-glow:rgba(244,63,94,0.25); }\n  html[data-theme=\"dark\"] .hover\\:bg-black\\/5:hover{ background-color: var(--hover) !important; }\n  /* Tailwind's default border colour is light grey; keep un-styled borders on the dark palette */\n  html[data-theme=\"dark\"] :is(.border, .border-t, .border-b, .border-y, .border-l, .border-r){ border-color: var(--line); }",
  "count": 1
 },
 {
  "old": "  body{\n    background:var(--bg);\n    color:var(--ink);",
  "new": "  body{\n    transition: background-color .25s ease, color .25s ease;\n    background:var(--bg);\n    color:var(--ink);",
  "count": 1
 },
 {
  "old": "::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:8px;}",
  "new": "::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:8px;}",
  "count": 1
 },
 {
  "old": "    background: linear-gradient(135deg, #16A34A 0%, #15803D 100%);\n    color:#FFFFFF;\n    border-radius: 12px;\n    overflow:visible;\n    box-shadow: 0 6px 16px -8px rgba(21,128,61,0.6);",
  "new": "    background: linear-gradient(135deg, var(--gold) 0%, var(--gold-hover) 100%);\n    color:#FFFFFF;\n    border-radius: 12px;\n    overflow:visible;\n    box-shadow: 0 6px 16px -8px var(--accent-shadow);",
  "count": 1
 },
 {
  "old": "    border-color: #BBF7D0;\n    box-shadow: 0 4px 12px rgba(16,24,40,0.06);",
  "new": "    border-color: var(--accent-border);\n    box-shadow: 0 4px 12px rgba(16,24,40,0.06);",
  "count": 1
 },
 {
  "old": "  .btn-primary:hover{ background: var(--gold-deep); }",
  "new": "  .btn-primary:hover{ background: var(--gold-hover); }",
  "count": 1
 },
 {
  "old": "  .btn-primary:disabled{ background:#D1D5DB; color:#9CA3AF; cursor:not-allowed; transform:none; }",
  "new": "  .btn-primary:disabled{ background:var(--disabled-bg); color:var(--disabled-fg); cursor:not-allowed; transform:none; }",
  "count": 1
 },
 {
  "old": "  .btn-gold{\n    background: #FFFFFF;",
  "new": "  .btn-gold{\n    background: var(--panel);",
  "count": 1
 },
 {
  "old": "  .btn-gold:disabled{ border-color:#D1D5DB; color:#9CA3AF; background:#F3F4F6; cursor:not-allowed; }",
  "new": "  .btn-gold:disabled{ border-color:var(--disabled-bg); color:var(--disabled-fg); background:var(--disabled-soft); cursor:not-allowed; }",
  "count": 1
 },
 {
  "old": "box-shadow:0 0 0 5px rgba(22,163,74,0.18); }",
  "new": "box-shadow:0 0 0 5px var(--accent-glow); }",
  "count": 1
 },
 {
  "old": "  .low-stock-banner{\n    background: #FEF2F2;\n    border: 1px solid #FECACA;\n  }",
  "new": "  .low-stock-banner{\n    background: var(--danger-bg);\n    border: 1px solid var(--danger-border);\n  }",
  "count": 1
 },
 {
  "old": "  .error-banner{ background:#FEF2F2; color:#B91C1C; border:1px solid #FECACA; }",
  "new": "  .error-banner{ background:var(--danger-bg); color:var(--danger-fg); border:1px solid var(--danger-border); }",
  "count": 1
 },
 {
  "old": "  .success-banner{ background:#F0FDF4; color:#15803D; border:1px solid #BBF7D0; }",
  "new": "  .success-banner{ background:var(--ok-bg); color:var(--ok-fg); border:1px solid var(--ok-border); }\n  .warn-banner{ background:var(--warn-bg); color:var(--warn-fg); border:1px solid var(--warn-border); }",
  "count": 1
 },
 {
  "old": "  input, select, textarea{ background: #FFFFFF; color: var(--ink); }",
  "new": "  input, select, textarea{ background: var(--input-bg); color: var(--ink); }",
  "count": 1
 },
 {
  "old": "  @media print{\n    body *{ visibility:hidden; }",
  "new": "  @media print{\n    html, html[data-theme=\"dark\"] body{ background:#FFFFFF !important; color:#111827 !important; }\n    body *{ visibility:hidden; }",
  "count": 1
 },
 {
  "old": "    .receipt{\n      width:320px; border:1.5px dashed #9CA3AF; border-radius:14px;",
  "new": "    .receipt{\n      background:#FFFFFF; width:320px; border:1.5px dashed #9CA3AF; border-radius:14px;",
  "count": 1
 },
 {
  "old": "<style>\n",
  "new": "<script>\n  // Saved theme (light / dark / auto + accent colour) is applied before the page paints, so there is no flash.\n  (function () {\n    try {\n      var t = JSON.parse(localStorage.getItem(\"cd_theme\") || \"{}\");\n      var dark = t.mode === \"dark\" || (t.mode === \"auto\" && window.matchMedia && matchMedia(\"(prefers-color-scheme: dark)\").matches);\n      document.documentElement.setAttribute(\"data-theme\", dark ? \"dark\" : \"light\");\n      document.documentElement.setAttribute(\"data-accent\", t.accent || \"green\");\n    } catch (e) {}\n  })();\n</script>\n<style>\n",
  "count": 1
 },
 {
  "old": "style={{ background: \"rgba(255,255,255,0.92)\", borderBottom: \"1px solid var(--line)\" }}",
  "new": "style={{ background: \"var(--panel-glass)\", borderBottom: \"1px solid var(--line)\" }}",
  "count": 2
 },
 {
  "old": "style={{ borderColor: \"var(--line)\", background: \"#FFFFFF\" }}",
  "new": "style={{ borderColor: \"var(--line)\", background: \"var(--panel)\" }}",
  "count": 1
 },
 {
  "old": "style={{ background: \"#fff\", borderColor: \"var(--line)\" }}",
  "new": "style={{ background: \"var(--panel)\", borderColor: \"var(--line)\" }}",
  "count": 1
 },
 {
  "old": "style={{ borderColor: \"var(--line)\", background: \"rgba(255,255,255,0.6)\" }}",
  "new": "style={{ borderColor: \"var(--line)\", background: \"var(--panel-soft)\" }}",
  "count": 1
 },
 {
  "old": "  edit: \"M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z\",",
  "new": "  edit: \"M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z\",\n  droplet: \"M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z\",",
  "count": 1
 },
 {
  "old": "/* ---------------- Language toggle (EN | বাং) ---------------- */",
  "new": "/* ---------------- Theme (light / dark / auto + accent colour) ---------------- */\nconst THEME_ACCENTS = [\n  { key: \"green\", color: \"#16A34A\" }, { key: \"blue\", color: \"#2563EB\" }, { key: \"orange\", color: \"#EA580C\" },\n  { key: \"purple\", color: \"#7C3AED\" }, { key: \"rose\", color: \"#E11D48\" },\n];\nfunction readTheme() {\n  try {\n    const t = JSON.parse(localStorage.getItem(\"cd_theme\") || \"{}\");\n    return {\n      mode: [\"light\", \"dark\", \"auto\"].includes(t.mode) ? t.mode : \"light\",\n      accent: THEME_ACCENTS.some(a => a.key === t.accent) ? t.accent : \"green\",\n    };\n  } catch (e) { return { mode: \"light\", accent: \"green\" }; }\n}\nfunction applyTheme(t) {\n  const dark = t.mode === \"dark\" || (t.mode === \"auto\" && window.matchMedia && window.matchMedia(\"(prefers-color-scheme: dark)\").matches);\n  document.documentElement.setAttribute(\"data-theme\", dark ? \"dark\" : \"light\");\n  document.documentElement.setAttribute(\"data-accent\", t.accent);\n}\nfunction ThemeMenu() {\n  const [theme, setTheme] = useState(readTheme);\n  const [open, setOpen] = useState(false);\n  const boxRef = useRef(null);\n\n  // apply + remember the choice; in \"auto\" mode also follow the device when it switches light/dark\n  useEffect(() => {\n    applyTheme(theme);\n    try { localStorage.setItem(\"cd_theme\", JSON.stringify(theme)); } catch (e) {}\n    if (theme.mode !== \"auto\" || !window.matchMedia) return;\n    const mq = window.matchMedia(\"(prefers-color-scheme: dark)\");\n    const onChange = () => applyTheme(theme);\n    mq.addEventListener(\"change\", onChange);\n    return () => mq.removeEventListener(\"change\", onChange);\n  }, [theme]);\n\n  // close the panel when clicking elsewhere\n  useEffect(() => {\n    if (!open) return;\n    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };\n    document.addEventListener(\"mousedown\", close);\n    return () => document.removeEventListener(\"mousedown\", close);\n  }, [open]);\n\n  const modes = [[\"light\", \"theme.light\"], [\"dark\", \"theme.dark\"], [\"auto\", \"theme.auto\"]];\n  return (\n    <div className=\"relative\" ref={boxRef}>\n      <button onClick={() => setOpen(o => !o)} title={tx(\"theme.title\")} aria-expanded={open}\n        className=\"w-9 h-9 rounded-lg grid place-items-center transition-colors hover:bg-black/5\">\n        <Icon path={I.droplet} className=\"w-5 h-5\" style={{ color: \"var(--gold)\" }} />\n      </button>\n      {open && (\n        <div className=\"absolute right-0 top-full mt-2 w-60 rounded-2xl border shadow-2xl p-3 z-50 fade-in\"\n          style={{ background: \"var(--panel)\", borderColor: \"var(--line)\" }}>\n          <div className=\"text-[11px] uppercase tracking-wide mb-2\" style={{ color: \"var(--ink-soft)\" }}>{tx(\"theme.mode\")}</div>\n          <div className=\"flex rounded-lg border overflow-hidden text-xs mb-3\" style={{ borderColor: \"var(--line)\" }}>\n            {modes.map(([key, label]) => (\n              <button key={key} onClick={() => setTheme(t => ({ ...t, mode: key }))} className=\"flex-1 px-2 py-2 transition-colors\"\n                style={{ background: theme.mode === key ? \"var(--gold)\" : \"transparent\", color: theme.mode === key ? \"#fff\" : \"var(--ink-soft)\" }}>\n                {tx(label)}\n              </button>\n            ))}\n          </div>\n          <div className=\"text-[11px] uppercase tracking-wide mb-2\" style={{ color: \"var(--ink-soft)\" }}>{tx(\"theme.accent\")}</div>\n          <div className=\"flex items-center gap-2\">\n            {THEME_ACCENTS.map(a => (\n              <button key={a.key} onClick={() => setTheme(t => ({ ...t, accent: a.key }))}\n                title={tx(\"theme.\" + a.key)} aria-label={tx(\"theme.\" + a.key)}\n                className=\"w-8 h-8 rounded-full grid place-items-center border-2 transition-transform hover:scale-110\"\n                style={{ background: a.color, borderColor: theme.accent === a.key ? \"var(--ink)\" : \"transparent\" }}>\n                {theme.accent === a.key && <Icon path={I.check} className=\"w-4 h-4\" style={{ color: \"#fff\" }} />}\n              </button>\n            ))}\n          </div>\n        </div>\n      )}\n    </div>\n  );\n}\n\n/* ---------------- Language toggle (EN | বাং) ---------------- */",
  "count": 1
 },
 {
  "old": "{role !== \"admin\" && <LangToggle onToggle={onToggleLang} />}",
  "new": "<ThemeMenu />\n          {role !== \"admin\" && <LangToggle onToggle={onToggleLang} />}",
  "count": 1
 },
 {
  "old": "<div className=\"flex items-center gap-2\">\n            <LangToggle onToggle={onToggleLang} />",
  "new": "<div className=\"flex items-center gap-2\">\n            <ThemeMenu />\n            <LangToggle onToggle={onToggleLang} />",
  "count": 1
 },
 {
  "old": "const LOW_STOCK_THRESHOLD = 10;",
  "new": "const LOW_STOCK_THRESHOLD = 10;\nconst LOW_BALANCE_THRESHOLD = 50; // wallet balance (৳) below which students/teachers get a top-up reminder",
  "count": 1
 },
 {
  "old": "const [wallet, setWallet] = useState({ balance: 0, transactions: [] });",
  "new": "const [wallet, setWallet] = useState({ balance: 0, transactions: [], loaded: false });",
  "count": 1
 },
 {
  "old": "const mapWallet = (data) => ({\n    balance: data.balance,",
  "new": "const mapWallet = (data) => ({\n    balance: data.balance,\n    loaded: true,",
  "count": 1
 },
 {
  "old": "  const [connected, setConnected] = useState(false);\n",
  "new": "  const [connected, setConnected] = useState(false);\n  const [lowBalanceDismissed, setLowBalanceDismissed] = useState(false);\n",
  "count": 1
 },
 {
  "old": "    setSession(null); setCart([]); setError(null); setNotificationCenterOpen(false);",
  "new": "    setSession(null); setCart([]); setError(null); setNotificationCenterOpen(false);\n    setWallet({ balance: 0, transactions: [], loaded: false }); setLowBalanceDismissed(false);",
  "count": 1
 },
 {
  "old": "            <button onClick={() => setSuccess(null)} className=\"font-700\">✕</button>\n          </div>\n        )}\n",
  "new": "            <button onClick={() => setSuccess(null)} className=\"font-700\">✕</button>\n          </div>\n        )}\n        {session.user.role !== \"admin\" && wallet.loaded && wallet.balance < LOW_BALANCE_THRESHOLD && !lowBalanceDismissed && tab !== \"wallet\" && (\n          <div className=\"warn-banner rounded-xl px-4 py-3 mb-5 text-sm flex justify-between items-center gap-3\">\n            <span>{tx(\"lowbal\", { b: taka(wallet.balance) })}</span>\n            <span className=\"flex items-center gap-3 shrink-0\">\n              <button onClick={() => setTab(\"wallet\")} className=\"btn-primary px-3 py-1.5 rounded-lg text-xs\">{tx(\"topup\")}</button>\n              <button onClick={() => setLowBalanceDismissed(true)} className=\"font-700\">✕</button>\n            </span>\n          </div>\n        )}\n",
  "count": 1
 },
 {
  "old": "\n  },\n  bn: {",
  "new": ",\n    \"theme.title\": \"Theme\",\n    \"theme.mode\": \"Mode\",\n    \"theme.light\": \"Light\",\n    \"theme.dark\": \"Dark\",\n    \"theme.auto\": \"Auto\",\n    \"theme.accent\": \"Accent colour\",\n    \"theme.green\": \"Green\",\n    \"theme.blue\": \"Blue\",\n    \"theme.orange\": \"Orange\",\n    \"theme.purple\": \"Purple\",\n    \"theme.rose\": \"Rose\",\n    \"lowbal\": \"Your wallet balance is low ({b}). Top up to keep ordering.\"\n  },\n  bn: {",
  "count": 1
 },
 {
  "old": "\n  }\n};\nconst tx = ",
  "new": ",\n    \"theme.title\": \"থিম\",\n    \"theme.mode\": \"মোড\",\n    \"theme.light\": \"লাইট\",\n    \"theme.dark\": \"ডার্ক\",\n    \"theme.auto\": \"অটো\",\n    \"theme.accent\": \"রঙ\",\n    \"theme.green\": \"সবুজ\",\n    \"theme.blue\": \"নীল\",\n    \"theme.orange\": \"কমলা\",\n    \"theme.purple\": \"বেগুনি\",\n    \"theme.rose\": \"গোলাপি\",\n    \"lowbal\": \"আপনার ওয়ালেটে ব্যালেন্স কম ({b})। অর্ডার চালিয়ে যেতে টপ-আপ করুন।\"\n  }\n};\nconst tx = ",
  "count": 1
 }
];

const raw = fs.readFileSync(target, "utf8");
const usesCRLF = raw.includes("\r\n");
let text = raw.replace(/\r\n/g, "\n");

if (text.includes("function ThemeMenu") || text.includes('data-accent="blue"')) {
  console.log("The theme is already in this file — nothing to do.");
  process.exit(0);
}

const problems = [];
PAIRS.forEach((p, i) => {
  const found = text.split(p.old).length - 1;
  if (found !== p.count) {
    problems.push("  #" + (i + 1) + ": expected " + p.count + " match(es), found " + found + "  ->  " + JSON.stringify(p.old.slice(0, 90)));
    return;
  }
  text = text.split(p.old).join(p.new);
});

if (problems.length) {
  console.error("NOTHING WAS CHANGED. Your file differs from what this script expects in " + problems.length + " place(s):\n" + problems.join("\n"));
  console.error("\nSend this message (and the file) back and it will be adjusted.");
  process.exit(2);
}

const backup = target + ".before-theme.bak";
fs.copyFileSync(target, backup);
fs.writeFileSync(target, usesCRLF ? text.replace(/\n/g, "\r\n") : text, "utf8");
console.log("Done. " + PAIRS.length + " edits applied to " + target);
console.log("Backup of your old file: " + backup);
console.log("Next: restart the backend if it is running, then hard-refresh the browser (Ctrl+Shift+R).");

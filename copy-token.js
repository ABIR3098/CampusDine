// copy-token.js — "Copy token" button on every order in the student's Orders tab.
// One tap copies the pickup token (e.g. C-104); the button shows "Copied!" for a moment.
// Run from the project main folder:  node copy-token.js   (frontend only — no backend restart needed)
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) { console.error("Run this from the project's main folder (frontend/campusdine.html not found)."); process.exit(1); }

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Feature: copy token */")) { console.log("Already applied — nothing to do."); process.exit(0); }

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
    "copytoken": "Copy token",
    "copied": "Copied!",
`);
rep("bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "copytoken": "টোকেন কপি",
    "copied": "কপি হয়েছে!",
`);

// helper: modern clipboard first, old-style copy as a fallback (works on http:// LAN addresses too)
rep("helper",
`function TrackOrder(`,
`/* Feature: copy token */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (_) { /* fall through to the old way */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (_) { return false; }
}
function TrackOrder(`);

// state
rep("state",
`  const [printOrder, setPrintOrder] = useState(null);
`,
`  const [printOrder, setPrintOrder] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
`);

// button (next to Print receipt)
rep("button",
`                  {tx("print")}
                </button>
                {o.status === "Received" && (`,
`                  {tx("print")}
                </button>
                <button type="button"
                  onClick={async () => {
                    const ok = await copyText(o.token);
                    if (ok) { setCopiedId(o.id); setTimeout(() => setCopiedId(null), 1500); }
                    else window.prompt(tx("copytoken") + ":", o.token);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border font-600 flex items-center gap-1.5 transition-colors hover:bg-black/5"
                  style={{ borderColor: "var(--line)", color: copiedId === o.id ? "var(--leaf)" : "var(--ink-soft)" }}>
                  {copiedId === o.id ? "✓ " + tx("copied") : "📋 " + tx("copytoken")}
                </button>
                {o.status === "Received" && (`);

fs.copyFileSync(FILE, FILE + ".bak20");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: Copy token button added to the Orders tab.");

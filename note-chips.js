// note-chips.js — quick tap chips for the "Note for the kitchen" box in the cart.
// Tap "Less spicy" / "No onion" / ... and it is added to the note; tap again to remove it.
// Run from the project main folder:  node note-chips.js   (frontend only — no backend restart needed)
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) { console.error("Run this from the project's main folder (frontend/campusdine.html not found)."); process.exit(1); }

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Feature: kitchen note chips */")) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`); process.exit(1); }
  s = s.replace(from, () => to);
}

// texts
rep("en text",
`    "note.ph": "e.g. less spicy, no onion",
`,
`    "note.ph": "e.g. less spicy, no onion",
    "chip.lessspicy": "Less spicy",
    "chip.noonion": "No onion",
    "chip.extrasauce": "Extra sauce",
    "chip.lessoil": "Less oil",
    "chip.nosugar": "No sugar",
    "chip.packsep": "Pack separately",
`);
rep("bn text",
`    "note.ph": "যেমন ঝাল কম, পেঁয়াজ ছাড়া",
`,
`    "note.ph": "যেমন ঝাল কম, পেঁয়াজ ছাড়া",
    "chip.lessspicy": "ঝাল কম",
    "chip.noonion": "পেঁয়াজ ছাড়া",
    "chip.extrasauce": "বেশি সস",
    "chip.lessoil": "তেল কম",
    "chip.nosugar": "চিনি ছাড়া",
    "chip.packsep": "আলাদা প্যাকেট",
`);

// helpers (outside the component)
rep("helpers",
`function MenuOrder(`,
`/* Feature: kitchen note chips */
const NOTE_CHIPS = ["chip.lessspicy", "chip.noonion", "chip.extrasauce", "chip.lessoil", "chip.nosugar", "chip.packsep"];
function noteHas(note, text) {
  return note.split(",").some(p => p.trim().toLowerCase() === text.toLowerCase());
}
function noteToggle(note, text) {
  const parts = note.split(",").map(p => p.trim()).filter(Boolean);
  const i = parts.findIndex(p => p.toLowerCase() === text.toLowerCase());
  if (i >= 0) { parts.splice(i, 1); return parts.join(", "); }
  const added = parts.concat(text).join(", ");
  return added.length > 200 ? note : added; // no room left: leave the note as it is
}
function MenuOrder(`);

// chips above the note box
rep("chips",
`                <textarea value={orderNote} onChange={e => setOrderNote(e.target.value.slice(0, 200))} rows={2} maxLength={200}`,
`                <div className="flex flex-wrap gap-1.5 mb-2">
                  {NOTE_CHIPS.map(k => {
                    const text = tx(k);
                    const on = noteHas(orderNote, text);
                    return (
                      <button key={k} type="button" onClick={() => setOrderNote(noteToggle(orderNote, text))}
                        className={"chip text-xs px-2.5 py-1 rounded-full" + (on ? " active-chip" : "")}>{text}</button>
                    );
                  })}
                </div>
                <textarea value={orderNote} onChange={e => setOrderNote(e.target.value.slice(0, 200))} rows={2} maxLength={200}`);

fs.copyFileSync(FILE, FILE + ".bak17");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: quick chips added to the kitchen note.");

// time-greeting.js — Menu tab: "Good morning, Demo! ☀️ It's breakfast time" + the menu opens on a category that fits the time of day.
//   5–11 breakfast -> Snacks · 11–15 lunch -> Heavy meals · 15–18 snack time -> Snacks · 18–22 dinner -> Heavy meals · late night -> Drinks
// The student can still tap any category; this only chooses where the menu starts.
// Run from the project main folder:  node time-greeting.js   (frontend only — no backend restart needed)
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) { console.error("Run this from the project's main folder (frontend/campusdine.html not found)."); process.exit(1); }

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Feature: time greeting */")) { console.log("Already applied — nothing to do."); process.exit(0); }

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
    "greet.morning": "Good morning",
    "greet.afternoon": "Good afternoon",
    "greet.evening": "Good evening",
    "greet.night": "Good night",
    "meal.breakfast": "It's breakfast time",
    "meal.lunch": "It's lunch time",
    "meal.snack": "Snack time",
    "meal.dinner": "It's dinner time",
    "meal.late": "Late-night cravings?",
`);
rep("bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "greet.morning": "শুভ সকাল",
    "greet.afternoon": "শুভ দুপুর",
    "greet.evening": "শুভ সন্ধ্যা",
    "greet.night": "শুভ রাত্রি",
    "meal.breakfast": "এখন সকালের নাস্তার সময়",
    "meal.lunch": "এখন দুপুরের খাবারের সময়",
    "meal.snack": "এখন নাস্তার সময়",
    "meal.dinner": "এখন রাতের খাবারের সময়",
    "meal.late": "রাতে ক্ষুধা লেগেছে?",
`);

// helpers + the user's name reaches the menu
rep("helpers and signature",
`function MenuOrder({`,
`/* Feature: time greeting */
function mealSlot(h) {
  if (h >= 5 && h < 11) return { meal: "breakfast", cat: "snacks" };
  if (h >= 11 && h < 15) return { meal: "lunch", cat: "heavy" };
  if (h >= 15 && h < 18) return { meal: "snack", cat: "snacks" };
  if (h >= 18 && h < 22) return { meal: "dinner", cat: "heavy" };
  return { meal: "late", cat: "drinks" };
}
function greetingFor(h) {
  if (h >= 5 && h < 12) return { key: "morning", icon: "☀️" };
  if (h >= 12 && h < 17) return { key: "afternoon", icon: "🌤️" };
  if (h >= 17 && h < 21) return { key: "evening", icon: "🌆" };
  return { key: "night", icon: "🌙" };
}
function MenuOrder({ userName,`);

// start on a category that fits the time (only if it has items)
rep("category",
`const [cat, setCat] = useState("heavy");`,
`const [cat, setCat] = useState(() => {
    const c = mealSlot(new Date().getHours()).cat;
    return menu.some(m => m.category === c) ? c : "heavy";
  });`);

// the greeting
rep("greeting",
`        <PromoSlider slides={slides} />`,
`        {userName && (() => {
          const h = new Date().getHours();
          const g = greetingFor(h);
          return (
            <div className="mb-4">
              <div className="font-display font-800 text-xl" style={{ color: "var(--ink)" }}>{g.icon} {tx("greet." + g.key)}, {String(userName).split(" ")[0]}!</div>
              <div className="text-sm" style={{ color: "var(--ink-soft)" }}>{tx("meal." + mealSlot(h).meal)}</div>
            </div>
          );
        })()}
        <PromoSlider slides={slides} />`);

// pass the name from the App
rep("pass name",
`sessionToken={session.token} loyaltyKey={loyaltyKey}`,
`sessionToken={session.token} loyaltyKey={loyaltyKey} userName={session.user.name}`);

fs.copyFileSync(FILE, FILE + ".bak19");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: time-of-day greeting added to the Menu tab.");

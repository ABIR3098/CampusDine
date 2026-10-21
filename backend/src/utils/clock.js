// Canteen-local clock helpers. Happy hours and the daily streak must follow the canteen's wall clock,
// not whatever timezone the server happens to run in. Set CANTEEN_TZ in .env (default Asia/Dhaka).
const TZ = process.env.CANTEEN_TZ || "Asia/Dhaka";

const fmtCache = new Map();
function formatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short",
    }));
  }
  return fmtCache.get(tz);
}
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// → { dateKey: "YYYY-MM-DD", dow: 0-6 (0 = Sunday), minutes: minutes since local midnight }
function localParts(date = new Date(), tz = TZ) {
  const parts = {};
  for (const p of formatter(tz).formatToParts(new Date(date))) parts[p.type] = p.value;
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    dow: DOW[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// "HH:MM" or "HH:MM:SS" → minutes since midnight (null when invalid)
function toMinutes(value) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(value || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// whole days between two "YYYY-MM-DD" keys (b - a)
function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { TZ, localParts, toMinutes, dayDiff, addDays };

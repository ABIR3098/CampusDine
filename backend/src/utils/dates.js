// All "what day is it" logic lives here so it never depends on the server's
// own timezone. Default is Bangladesh time (UTC+06:00).
const OFFSET = process.env.APP_TZ_OFFSET || "+06:00";

function offsetMinutes() {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(OFFSET);
  if (!m) return 360;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

const shifted = (ms = Date.now()) => new Date(ms + offsetMinutes() * 60000);
const todayStr = () => shifted().toISOString().slice(0, 10);
const isDateOnly = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const addDays = (dateStr, n) => new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
// Normalises a DATE column value (string or Date) to YYYY-MM-DD.
const toDateStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
// Instant when the meal is served on `mealDate`, in the app timezone.
const mealStart = (mealDate, mealTime = process.env.MEAL_TIME || "12:00") => new Date(`${toDateStr(mealDate)}T${mealTime}:00${OFFSET}`);

const nowMinutes = () => { const d = shifted(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const weekdayOf = (dateStr) => new Date(`${toDateStr(dateStr)}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const isWeekend = (dateStr) => [5, 6].includes(weekdayOf(dateStr)); // Friday + Saturday in Bangladesh
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
const fromMin = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

module.exports = { OFFSET, todayStr, isDateOnly, addDays, toDateStr, mealStart, nowMinutes, weekdayOf, isWeekend, toMin, fromMin };

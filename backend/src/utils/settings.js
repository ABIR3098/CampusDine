// Canteen-wide settings stored in the app_settings table (editable by the admin).
const DEFAULTS = {
  open_time: "11:00", close_time: "15:00", slot_capacity: 15,
  ramadan_mode: false, maghrib_time: "18:00",
  jummah_mode: true, jummah_start: "12:30", jummah_end: "14:00", jummah_capacity_mult: 1.5,
  surplus_enabled: true, surplus_percent: 30, surplus_minutes: 45,
  prep_min_per_order: 3,
};
const RULES = {
  open_time: ["time"], close_time: ["time"], maghrib_time: ["time"], jummah_start: ["time"], jummah_end: ["time"],
  slot_capacity: ["int", 1, 500], jummah_capacity_mult: ["float", 0.5, 5],
  surplus_percent: ["int", 5, 90], surplus_minutes: ["int", 5, 240], prep_min_per_order: ["float", 0.5, 30],
  ramadan_mode: ["bool"], jummah_mode: ["bool"], surplus_enabled: ["bool"],
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parse(key, raw) {
  const def = DEFAULTS[key];
  if (typeof def === "boolean") return raw === "true" || raw === "1" || raw === true;
  if (typeof def === "number") { const n = Number(raw); return Number.isFinite(n) ? n : def; }
  return String(raw);
}

async function loadSettings(q) {
  const [rows] = await q.query("SELECT k, v FROM app_settings");
  const out = { ...DEFAULTS };
  for (const r of rows) if (r.k in DEFAULTS) out[r.k] = parse(r.k, r.v);
  return out;
}

// Returns { error } or { value } (only the recognised keys, correctly typed).
function validateSettings(patch, current) {
  const value = {};
  for (const [key, raw] of Object.entries(patch || {})) {
    const rule = RULES[key];
    if (!rule) continue;
    const [type, min, max] = rule;
    if (type === "time") { if (!TIME_RE.test(String(raw))) return { error: `${key} must be HH:MM` }; value[key] = String(raw); }
    else if (type === "bool") { if (typeof raw !== "boolean") return { error: `${key} must be true or false` }; value[key] = raw; }
    else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < min || n > max || (type === "int" && !Number.isInteger(n))) return { error: `${key} must be ${type === "int" ? "a whole number" : "a number"} between ${min} and ${max}` };
      value[key] = n;
    }
  }
  const merged = { ...current, ...value };
  if (merged.open_time >= merged.close_time) return { error: "open_time must be earlier than close_time" };
  if (merged.jummah_start >= merged.jummah_end) return { error: "jummah_start must be earlier than jummah_end" };
  return { value };
}

async function saveSettings(q, value) {
  for (const [k, v] of Object.entries(value)) await q.query("INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [k, String(v)]);
}

module.exports = { DEFAULTS, loadSettings, validateSettings, saveSettings };

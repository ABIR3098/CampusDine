// 10-minute pickup slots, with Friday/Jummah windows and Ramadan iftar slots.
const { todayStr, nowMinutes, weekdayOf, toMin, fromMin, mealStart } = require("./dates");
const SLOT_MIN = 10;

function windowsFor(dateStr, S) {
  const open = toMin(S.open_time), close = toMin(S.close_time);
  const w = [];
  if (S.jummah_mode && weekdayOf(dateStr) === 5) {
    // Friday: the canteen pauses for Jummah; the two shoulders get extra capacity because everyone rushes.
    const js = toMin(S.jummah_start), je = toMin(S.jummah_end);
    if (js > open) w.push({ from: open, to: Math.min(js, close), kind: "lunch", mult: S.jummah_capacity_mult });
    if (je < close) w.push({ from: Math.max(je, open), to: close, kind: "lunch", mult: S.jummah_capacity_mult });
  } else {
    w.push({ from: open, to: close, kind: "lunch", mult: 1 });
  }
  if (S.ramadan_mode) { const m = toMin(S.maghrib_time); w.push({ from: m - 60, to: m - 10, kind: "iftar", mult: 1.5 }); }
  return w;
}

function slotList(dateStr, S) {
  const byTime = new Map(); // a time can only appear once; iftar (listed last) wins over an overlapping lunch slot
  for (const w of windowsFor(dateStr, S)) {
    for (let t = w.from; t + SLOT_MIN <= w.to; t += SLOT_MIN) byTime.set(fromMin(t), { time: fromMin(t), endTime: fromMin(t + SLOT_MIN), kind: w.kind, capacity: Math.max(1, Math.round(S.slot_capacity * w.mult)) });
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

const slotStatus = (booked, cap) => (booked >= cap ? "full" : booked / cap >= 0.7 ? "busy" : booked / cap >= 0.4 ? "moderate" : "quiet");
const isPast = (dateStr, time) => dateStr === todayStr() && toMin(time) < nowMinutes();

async function loadCounts(q, dateStr) {
  const [rows] = await q.query("SELECT pickup_slot, COUNT(*) AS n FROM orders WHERE meal_date = ? AND pickup_slot IS NOT NULL AND status NOT IN ('Cancelled','Refunded') GROUP BY pickup_slot", [dateStr]);
  return new Map(rows.map((r) => [r.pickup_slot, r.n]));
}

// Slots + live load. `classes` = the viewer's lectures that day (optional) so clashes can be flagged.
async function slotsWithLoad(q, dateStr, S, classes = []) {
  const counts = await loadCounts(q, dateStr);
  return slotList(dateStr, S).map((s) => {
    const booked = counts.get(s.time) || 0;
    const a = toMin(s.time), b = a + SLOT_MIN;
    const clash = classes.find((c) => toMin(c.start_time.slice(0, 5)) < b + 5 && toMin(c.end_time.slice(0, 5)) > a - 5); // 5 min walking buffer
    const past = isPast(dateStr, s.time);
    return { ...s, booked, status: slotStatus(booked, s.capacity), past, available: !past && booked < s.capacity, clash: clash ? clash.title : null };
  });
}

module.exports = { SLOT_MIN, slotList, slotsWithLoad, slotStatus, isPast, loadCounts, windowsFor, mealStart };

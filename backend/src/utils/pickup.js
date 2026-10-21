// Pre-order pickup slot rules (shared by placing an order and by the price quote, so a happy hour
// is judged against the same moment the order will really be picked up).
const PICKUP_MIN_LEAD_MINUTES = 10;
const PICKUP_MAX_LEAD_HOURS = 4;

// "HH:MM" (24h) → Date, or null when no pickup time was sent. Throws { status: 400 } for bad input.
function resolvePickupTime(value) {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw { status: 400, message: "pickupTime must be in HH:MM 24-hour format" };

  // Truncate seconds so the allowed window matches exactly what a minute-precision
  // <input type="time"> can express — otherwise picking the exact displayed min/max
  // minute could still fail by a few leftover seconds.
  const now = new Date();
  now.setSeconds(0, 0);
  const minAllowed = new Date(now.getTime() + PICKUP_MIN_LEAD_MINUTES * 60000);
  const maxAllowed = new Date(now.getTime() + PICKUP_MAX_LEAD_HOURS * 3600000);

  // "14:05" could mean today or, once the window crosses midnight, tomorrow —
  // try both and accept whichever actually falls inside the allowed window.
  const buildCandidate = (dayOffset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return d;
  };
  const candidate = [0, 1].map(buildCandidate).find((d) => d >= minAllowed && d <= maxAllowed);
  if (!candidate) {
    throw {
      status: 400,
      message: `Pickup time must be at least ${PICKUP_MIN_LEAD_MINUTES} minutes and at most ${PICKUP_MAX_LEAD_HOURS} hours from now`,
    };
  }
  return candidate;
}

module.exports = { resolvePickupTime, PICKUP_MIN_LEAD_MINUTES, PICKUP_MAX_LEAD_HOURS };

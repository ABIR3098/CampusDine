// Helpers for feast RSVPs. No database code in here, so they are easy to test.
const RSVP_STATUSES = ["going", "not_going"];

// "going" / "not_going" (any case, spaces around are fine) -> the clean value; anything else -> null
function parseRsvpStatus(value) {
  const s = String(value == null ? "" : value).trim().toLowerCase();
  return RSVP_STATUSES.includes(s) ? s : null;
}

// Can one more person say going? capacity null/undefined = no limit.
// goingCount = people already going; alreadyGoing = true when this person is one of them.
function hasSeat(capacity, goingCount, alreadyGoing = false) {
  if (capacity == null) return true;
  if (alreadyGoing) return true;
  return Number(goingCount) < Number(capacity);
}

module.exports = { RSVP_STATUSES, parseRsvpStatus, hasSeat };

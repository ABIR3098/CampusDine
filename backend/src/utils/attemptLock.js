// Wrong-password lock-out: after `max` failures for the same key, that key is locked for `lockMs`.
// Kept in memory, like the lock-out in routes/auth.js, so it resets when the server restarts.
// `now` can be replaced in tests. A failure older than `lockMs` is forgotten.
function createAttemptLock({ max = 5, lockMs = 10 * 60 * 1000, now = Date.now } = {}) {
  const fails = new Map();

  return {
    // milliseconds left on the lock, or 0 when the key is free
    lockedFor(key) {
      const f = fails.get(key);
      if (!f || f.count < max) return 0;
      const left = f.last + lockMs - now();
      if (left <= 0) { fails.delete(key); return 0; }
      return left;
    },
    noteFail(key) {
      const t = now();
      const f = fails.get(key);
      const fresh = !f || t - f.last > lockMs;
      fails.set(key, { count: fresh ? 1 : f.count + 1, last: t });
    },
    clear(key) { fails.delete(key); },
    // drop old entries; call it now and then so the map cannot grow without end
    sweep() {
      const t = now();
      for (const [key, f] of fails) if (t - f.last > lockMs) fails.delete(key);
    },
  };
}

module.exports = { createAttemptLock };

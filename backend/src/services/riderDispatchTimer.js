// Every few seconds, give waiting teacher orders to riders that are free.
// This covers the cases no event catches: a rider who was busy has just finished a delivery,
// or a rider app was closed and opened again and no position arrived at the right moment.
const DEFAULT_SECONDS = 20;

// RIDER_DISPATCH_SECONDS: empty -> 20, 0 -> off, 1 to 3600 -> that many seconds.
function dispatchSeconds(value) {
  if (value === undefined || value === null || String(value).trim() === "") return DEFAULT_SECONDS;
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) return DEFAULT_SECONDS;
  return seconds;
}

function startRiderDispatchTimer({ dispatcher, io, seconds = DEFAULT_SECONDS, setIntervalFn = setInterval }) {
  if (!seconds) return null;
  const timer = setIntervalFn(() => { dispatcher.dispatchQuietly({ io }); }, seconds * 1000);
  // The timer alone must not keep the process alive when the server is shutting down.
  if (timer && typeof timer.unref === "function") timer.unref();
  return timer;
}

module.exports = { startRiderDispatchTimer, dispatchSeconds, DEFAULT_SECONDS };

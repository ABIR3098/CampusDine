const { assignPendingTeacherOrders } = require("../utils/riderAssignment");
const { recordAuditEvent } = require("../utils/audit");

// Used for the audit log when nobody asked for the dispatch (the timer on the server).
const SYSTEM_ACTOR = { user: { id: null, role: "system" }, socket: {} };

// Gives waiting teacher orders to free riders.
// - One run at a time: a call made while a run is going shares that run's result.
// - minGapMs: skip the run if the last one ended less than this long ago (0 = always run).
// - req: the request of whoever caused the run (shown in the audit log); the server timer sends none.
function createRiderDispatcher({ pool, now = Date.now }) {
  let running = null;
  let lastEndedAt = -Infinity; // the first run is never skipped

  function dispatch({ io, req, minGapMs = 0 } = {}) {
    if (running) return running;
    if (minGapMs > 0 && now() - lastEndedAt < minGapMs) return Promise.resolve([]);
    const actor = req && req.user ? req : SYSTEM_ACTOR;
    running = assignPendingTeacherOrders(pool, {
      onAssigned: ({ orderId, riderId }, connection) =>
        recordAuditEvent(connection, actor, "AUTO_RIDER_ASSIGN", "order", orderId, { riderId }),
    }).then((assigned) => {
      if (io) for (const { orderId, riderId } of assigned) io.to(`rider:${riderId}`).emit("rider:order-assigned", { orderId });
      return assigned;
    }).finally(() => {
      lastEndedAt = now();
      running = null;
    });
    return running;
  }

  // For code that must not fail because of a dispatch (a location update, for example).
  function dispatchQuietly(options) {
    return dispatch(options).catch((error) => {
      console.error("Rider dispatch failed:", error.message);
      return [];
    });
  }

  return { dispatch, dispatchQuietly };
}

module.exports = { createRiderDispatcher, SYSTEM_ACTOR };

// Express 4 does NOT automatically catch a rejected promise thrown inside
// an async route handler — it turns into an unhandled rejection and takes
// down the *entire* Node process (every logged-in user, every request).
// That's exactly what was happening here: a missing table made one query
// reject, and the whole server crashed instead of returning a normal
// error response.
//
// Wrapping every async handler with catchAsync forwards that rejection to
// next(err), which server.js's error-handling middleware turns into a
// clean { error: "..." } response — one bad request stays one bad
// request instead of crashing the API for everyone.
module.exports = function catchAsync(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

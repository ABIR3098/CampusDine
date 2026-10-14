// Express 4 does not catch rejected promises from async route handlers: one
// bad request used to crash the WHOLE Node process. This patches Express's
// Layer so any rejection / sync throw is forwarded to the error middleware.
// Must be required BEFORE any router is created.
const Layer = require("express/lib/router/layer");

Layer.prototype.handle_request = function handle(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next(); // error-handling middleware, skip
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === "function") result.catch(next);
  } catch (err) {
    next(err);
  }
};

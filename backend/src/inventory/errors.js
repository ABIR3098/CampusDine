// Turns a MySQL failure into a readable message for the admin screen. In production the caller keeps the vague
// "Something went wrong" so database details are never shown to users; the real error is still printed on the server.

function describeDbError(err, env = process.env.NODE_ENV) {
  if (!err || env === "production") return null;
  const code = typeof err.code === "string" ? err.code : "";
  if (!code.startsWith("ER_") && !err.sqlMessage) return null;
  const outdated = code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
  const reason = String(err.sqlMessage || err.message || "unknown error");
  return `Database error${code ? ` (${code})` : ""}: ${reason}${outdated ? " - restart the server so the inventory tables are updated." : ""}`;
}

module.exports = { describeDbError };

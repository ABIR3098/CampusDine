// CampusDine Middleware: Security & Audit Logging
function auditLogger(req, res, next) {
  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl || req.url;

  // Intercept response finish
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const user = req.user ? `[User:${req.user.id}|Role:${req.user.role}]` : "[Guest]";

    // Log write/mutating actions or errors
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) || statusCode >= 400) {
      console.log(`[AUDIT] ${new Date().toISOString()} ${method} ${path} -> ${statusCode} (${duration}ms) ${user}`);
    }
  });

  next();
}

module.exports = auditLogger;

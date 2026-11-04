// CampusDine Middleware: Sliding Window Rate Limiter
const requestCounts = new Map();

function rateLimiter({ windowMs = 60000, maxRequests = 100, message = "Too many requests, please try again later." } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || "global";
    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }

    const timestamps = requestCounts.get(ip);
    // Filter out requests older than the window
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= maxRequests) {
      return res.status(429).json({ error: message, retryAfterSeconds: Math.ceil(windowMs / 1000) });
    }

    recent.push(now);
    requestCounts.set(ip, recent);
    next();
  };
}

module.exports = rateLimiter;

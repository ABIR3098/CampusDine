// CampusDine Validator: Auth Credentials & Profile Validation
function validateLoginPayload(req, res, next) {
  const { externalId, password } = req.body;
  if (!externalId || typeof externalId !== "string" || !externalId.trim()) {
    return res.status(400).json({ error: "Student or Employee ID is required" });
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters long" });
  }
  next();
}

function validateRegisterPayload(req, res, next) {
  const { name, externalId, password, email, role } = req.body;
  // Values that are not text (a number, an object) used to crash on .trim() or skip the length check.
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Full name is required" });
  }
  if (!externalId || typeof externalId !== "string" || !externalId.trim()) {
    return res.status(400).json({ error: "Campus ID is required" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }
  if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  next();
}

module.exports = { validateLoginPayload, validateRegisterPayload };

// Rules for profile edits (PUT /api/auth/me).

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// Changing the e-mail (or adding one to an account that has none) also changes where
// "forgot password" codes go, so the person must prove they know the current password.
// Saving the same address again (the profile form always sends it) needs no password.
function emailChangeNeedsPassword(currentEmail, newEmail) {
  const next = normaliseEmail(newEmail);
  if (!next) return false;
  return next !== normaliseEmail(currentEmail);
}

module.exports = { normaliseEmail, emailChangeNeedsPassword };

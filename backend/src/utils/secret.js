// One place for the signing secret used by order QR codes and email OTPs.
// The server (server.js) always sets JWT_SECRET before these modules run. This helper only
// matters for tools and tests: outside production they get a fixed development secret, and in
// production a missing secret is an error instead of a silent, publicly known default.
const DEV_SECRET = "campusdine-dev-secret";

function getSigningSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set");
  }
  return DEV_SECRET;
}

module.exports = { getSigningSecret, DEV_SECRET };

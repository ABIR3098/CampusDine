// Signed pickup-token QR payloads.
//
// The QR on an order ticket does not contain just "C-105" (anyone could type
// or guess that). It contains  CD1|C-105|<signature>  where the signature is an
// HMAC of the token made with the server's secret, so the counter can tell a
// genuine CampusDine QR from a made-up one.
const crypto = require("crypto");

const PREFIX = "CD1";

function secret() {
  return process.env.JWT_SECRET || "campusdine-dev-secret";
}

function sign(token) {
  return crypto.createHmac("sha256", secret()).update(`order:${token}`).digest("hex").slice(0, 12).toUpperCase();
}

function buildPayload(token) {
  return `${PREFIX}|${token}|${sign(token)}`;
}

// Accepts either a scanned QR payload ("CD1|C-105|AB12CD34EF56") or a token that
// was typed by hand ("c-105"). Returns { token, signed, valid }.
function parseCode(raw) {
  const text = String(raw || "").trim();
  if (!text) return { token: null, signed: false, valid: false };

  if (text.toUpperCase().startsWith(PREFIX + "|")) {
    const parts = text.split("|");
    if (parts.length !== 3) return { token: null, signed: true, valid: false };
    const token = parts[1].trim().toUpperCase();
    const given = Buffer.from(parts[2].trim().toUpperCase());
    const expected = Buffer.from(sign(token));
    const valid = given.length === expected.length && crypto.timingSafeEqual(given, expected);
    return { token, signed: true, valid };
  }

  return { token: text.toUpperCase(), signed: false, valid: true };
}

module.exports = { buildPayload, parseCode, sign };

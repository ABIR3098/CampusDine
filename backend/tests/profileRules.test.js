const test = require("node:test");
const assert = require("node:assert/strict");
const { normaliseEmail, emailChangeNeedsPassword } = require("../src/utils/profileRules");

test("normaliseEmail trims, lower-cases and survives empty values", () => {
  assert.equal(normaliseEmail("  Rahim@Example.COM "), "rahim@example.com");
  assert.equal(normaliseEmail(null), "");
  assert.equal(normaliseEmail(undefined), "");
});

test("saving the same e-mail again needs no password", () => {
  assert.equal(emailChangeNeedsPassword("a@b.com", "a@b.com"), false);
  assert.equal(emailChangeNeedsPassword("a@b.com", "  A@B.com "), false);
});

test("a different e-mail needs the password", () => {
  assert.equal(emailChangeNeedsPassword("a@b.com", "c@d.com"), true);
});

test("adding the first e-mail to an account without one needs the password", () => {
  assert.equal(emailChangeNeedsPassword(null, "a@b.com"), true);
  assert.equal(emailChangeNeedsPassword("", "a@b.com"), true);
});

test("an empty new e-mail is not an e-mail change", () => {
  assert.equal(emailChangeNeedsPassword("a@b.com", ""), false);
  assert.equal(emailChangeNeedsPassword("a@b.com", "   "), false);
});

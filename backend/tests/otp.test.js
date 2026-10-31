process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createOtp, verifyOtp, MAX_ATTEMPTS, RESEND_COOLDOWN_SEC } = require("../src/utils/otp");

// A small in-memory stand-in for the email_otps table. It reads the SQL text to decide what to do.
function fakeDb({ lastAge = null, lastHour = 0 } = {}) {
  const rows = [];
  const db = {
    rows,
    async query(sql, params = []) {
      if (sql.includes("TIMESTAMPDIFF")) return [[lastAge === null ? undefined : { age: lastAge }]];
      if (sql.includes("COUNT(*)")) return [[{ n: lastHour }]];
      if (sql.startsWith("UPDATE email_otps SET used_at = NOW() WHERE email")) {
        rows.filter((r) => !r.used).forEach((r) => { r.used = true; });
        return [{}];
      }
      if (sql.includes("INSERT INTO email_otps")) {
        rows.push({ id: rows.length + 1, code_hash: params[2], attempts: 0, used: false });
        return [{ insertId: rows.length }];
      }
      if (sql.includes("SELECT id, code_hash, attempts")) {
        const live = rows.filter((r) => !r.used);
        const last = live[live.length - 1];
        return [[last ? { ...last } : undefined]]; // a copy, like a real database row
      }
      if (sql.includes("attempts = attempts + 1")) {
        rows.find((r) => r.id === params[0]).attempts += 1;
        return [{}];
      }
      if (sql.includes("SET used_at = NOW() WHERE id = ?")) {
        const row = rows.find((r) => r.id === params[0]);
        if (row.used) return [{ affectedRows: 0 }];
        row.used = true;
        return [{ affectedRows: 1 }];
      }
      return [{}]; // fraud log and anything else
    },
  };
  return db;
}

test("createOtp makes a 6-digit code and stores only its hash", async () => {
  const db = fakeDb();
  const r = await createOtp(db, " User@Mail.com ", "signup");
  assert.equal(r.ok, true);
  assert.match(r.code, /^\d{6}$/);
  assert.equal(db.rows.length, 1);
  assert.notEqual(db.rows[0].code_hash, r.code);
  assert.equal(db.rows[0].code_hash.length, 64);
});

test("createOtp refuses a missing email or an unknown purpose", async () => {
  assert.equal((await createOtp(fakeDb(), "", "signup")).status, 400);
  assert.equal((await createOtp(fakeDb(), "a@b.com", "nonsense")).status, 400);
});

test("createOtp makes you wait between codes", async () => {
  const r = await createOtp(fakeDb({ lastAge: 20 }), "a@b.com", "reset");
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
  assert.equal(r.retryAfter, RESEND_COOLDOWN_SEC - 20);
});

test("createOtp stops after 5 codes in an hour", async () => {
  const r = await createOtp(fakeDb({ lastAge: 500, lastHour: 5 }), "a@b.com", "reset");
  assert.equal(r.status, 429);
  assert.match(r.error, /hour/);
});

test("a new code cancels the older one", async () => {
  const db = fakeDb();
  await createOtp(db, "a@b.com", "login2fa");
  await createOtp(db, "a@b.com", "login2fa");
  assert.equal(db.rows[0].used, true);
  assert.equal(db.rows[1].used, false);
});

test("the right code works once, then fails", async () => {
  const db = fakeDb();
  const { code } = await createOtp(db, "a@b.com", "signup");
  assert.deepEqual(await verifyOtp(db, "A@B.com", "signup", code), { ok: true });
  const again = await verifyOtp(db, "a@b.com", "signup", code);
  assert.equal(again.ok, false);
});

test("a code for one purpose does not work for another", async () => {
  const db = fakeDb();
  const { code } = await createOtp(db, "a@b.com", "signup");
  const r = await verifyOtp(db, "a@b.com", "reset", code);
  assert.equal(r.ok, false);
});

test("verifyOtp wants exactly six digits", async () => {
  const db = fakeDb();
  await createOtp(db, "a@b.com", "signup");
  for (const bad of ["12345", "1234567", "abcdef", "", null]) {
    assert.equal((await verifyOtp(db, "a@b.com", "signup", bad)).status, 400, String(bad));
  }
});

test("a wrong code counts the attempt and reports how many are left", async () => {
  const db = fakeDb();
  const { code } = await createOtp(db, "a@b.com", "signup");
  const wrong = code === "111111" ? "222222" : "111111";
  const r = await verifyOtp(db, "a@b.com", "signup", wrong);
  assert.equal(r.ok, false);
  assert.match(r.error, new RegExp(`${MAX_ATTEMPTS - 1} attempt`));
  assert.equal(db.rows[0].attempts, 1);
});

test("after 5 wrong tries even the right code is refused", async () => {
  const db = fakeDb();
  const { code } = await createOtp(db, "a@b.com", "signup");
  const wrong = code === "111111" ? "222222" : "111111";
  for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyOtp(db, "a@b.com", "signup", wrong);
  const r = await verifyOtp(db, "a@b.com", "signup", code);
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
});

test("with no live code the answer is expired or not found", async () => {
  const r = await verifyOtp(fakeDb(), "a@b.com", "signup", "123456");
  assert.equal(r.status, 400);
  assert.match(r.error, /expired or not found/);
});

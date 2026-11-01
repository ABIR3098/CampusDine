const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureCode, REFERRAL_BONUS, MAX_REWARDS_PER_REFERRER } = require("../src/referrals");

const CODE_SHAPE = /^CD[A-HJ-NP-Z2-9]{5}$/; // "CD" + 5 characters, never 0 O 1 I

test("the bonus and the cap have the documented values", () => {
  assert.equal(REFERRAL_BONUS, 20);
  assert.equal(MAX_REWARDS_PER_REFERRER, 10);
});

test("a user who already has a code gets it back and nothing is written", async () => {
  const calls = [];
  const pool = { query: async (sql) => { calls.push(sql); return [[{ referral_code: "CDABC23" }]]; } };
  assert.equal(await ensureCode(pool, 5), "CDABC23");
  assert.equal(calls.length, 1);
});

test("a new code has the right shape and is stored", async () => {
  const updates = [];
  const pool = {
    query: async (sql, params) => {
      if (sql.startsWith("SELECT")) return [[{ referral_code: null }]];
      updates.push(params);
      return [{ affectedRows: 1 }];
    },
  };
  const code = await ensureCode(pool, 7);
  assert.match(code, CODE_SHAPE);
  assert.deepEqual(updates, [[code, 7]]);
});

test("when the code is already taken it tries another one", async () => {
  let updateCalls = 0;
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT")) return [[{ referral_code: null }]];
      updateCalls += 1;
      if (updateCalls === 1) throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
      return [{ affectedRows: 1 }];
    },
  };
  assert.match(await ensureCode(pool, 7), CODE_SHAPE);
  assert.equal(updateCalls, 2);
});

test("if another request set the code first, that code is returned", async () => {
  let selects = 0;
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT")) { selects += 1; return [[{ referral_code: selects === 1 ? null : "CDWINNER" }]]; }
      return [{ affectedRows: 0 }];
    },
  };
  assert.equal(await ensureCode(pool, 7), "CDWINNER");
});

test("an unexpected database error is not hidden", async () => {
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT")) return [[{ referral_code: null }]];
      throw Object.assign(new Error("connection lost"), { code: "ECONNRESET" });
    },
  };
  await assert.rejects(() => ensureCode(pool, 7), /connection lost/);
});

test("after 8 clashes in a row it gives up with a clear error", async () => {
  let updateCalls = 0;
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT")) return [[{ referral_code: null }]];
      updateCalls += 1;
      throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
    },
  };
  await assert.rejects(() => ensureCode(pool, 7), /Could not create a referral code/);
  assert.equal(updateCalls, 8);
});

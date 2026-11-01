const test = require("node:test");
const assert = require("node:assert/strict");
const { getSigningSecret, DEV_SECRET } = require("../src/utils/secret");

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

test("JWT_SECRET is used when it is set", () => {
  withEnv({ JWT_SECRET: "abc", NODE_ENV: "production" }, () => {
    assert.equal(getSigningSecret(), "abc");
  });
});

test("outside production a missing secret falls back to the dev secret", () => {
  withEnv({ JWT_SECRET: undefined, NODE_ENV: "test" }, () => {
    assert.equal(getSigningSecret(), DEV_SECRET);
  });
});

test("in production a missing secret is an error, not a public default", () => {
  withEnv({ JWT_SECRET: undefined, NODE_ENV: "production" }, () => {
    assert.throws(() => getSigningSecret(), /JWT_SECRET is not set/);
  });
});

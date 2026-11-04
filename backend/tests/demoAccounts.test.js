const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldSeedDemoAccounts } = require("../src/utils/demoAccounts");

test("demo accounts are created by default on a developer machine", () => {
  assert.equal(shouldSeedDemoAccounts({}), true);
  assert.equal(shouldSeedDemoAccounts({ NODE_ENV: "development" }), true);
});

test("demo accounts are not created when NODE_ENV is production", () => {
  assert.equal(shouldSeedDemoAccounts({ NODE_ENV: "production" }), false);
  assert.equal(shouldSeedDemoAccounts({ NODE_ENV: " Production " }), false);
});

test("SEED_DEMO_ACCOUNTS overrides NODE_ENV in both directions", () => {
  assert.equal(shouldSeedDemoAccounts({ NODE_ENV: "production", SEED_DEMO_ACCOUNTS: "true" }), true);
  assert.equal(shouldSeedDemoAccounts({ NODE_ENV: "development", SEED_DEMO_ACCOUNTS: "false" }), false);
  assert.equal(shouldSeedDemoAccounts({ SEED_DEMO_ACCOUNTS: "FALSE" }), false);
});

test("an unknown SEED_DEMO_ACCOUNTS value falls back to the NODE_ENV rule", () => {
  assert.equal(shouldSeedDemoAccounts({ SEED_DEMO_ACCOUNTS: "yes", NODE_ENV: "production" }), false);
  assert.equal(shouldSeedDemoAccounts({ SEED_DEMO_ACCOUNTS: "yes" }), true);
});

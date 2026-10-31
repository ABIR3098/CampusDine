const test = require("node:test");
const assert = require("node:assert/strict");
const { createAttemptLock } = require("../src/utils/attemptLock");

function setup(options = {}) {
  const clock = { t: 1000000 };
  const lock = createAttemptLock({ max: 3, lockMs: 60000, now: () => clock.t, ...options });
  return { clock, lock };
}

test("a key is free until it reaches the failure limit", () => {
  const { lock } = setup();
  lock.noteFail("a"); lock.noteFail("a");
  assert.equal(lock.lockedFor("a"), 0);
  lock.noteFail("a");
  assert.equal(lock.lockedFor("a"), 60000);
});

test("the time left counts down and the key frees itself", () => {
  const { clock, lock } = setup();
  for (let i = 0; i < 3; i++) lock.noteFail("a");
  clock.t += 45000;
  assert.equal(lock.lockedFor("a"), 15000);
  clock.t += 15000;
  assert.equal(lock.lockedFor("a"), 0);
  lock.noteFail("a"); // starts again from one failure
  assert.equal(lock.lockedFor("a"), 0);
});

test("other keys are not affected", () => {
  const { lock } = setup();
  for (let i = 0; i < 3; i++) lock.noteFail("a");
  assert.equal(lock.lockedFor("b"), 0);
});

test("clear removes the failures after a good login", () => {
  const { lock } = setup();
  lock.noteFail("a"); lock.noteFail("a");
  lock.clear("a");
  lock.noteFail("a"); lock.noteFail("a");
  assert.equal(lock.lockedFor("a"), 0);
});

test("old failures are forgotten, so slow guessing never locks", () => {
  const { clock, lock } = setup();
  lock.noteFail("a"); lock.noteFail("a");
  clock.t += 61000;
  lock.noteFail("a");
  assert.equal(lock.lockedFor("a"), 0);
});

test("sweep removes old entries only", () => {
  const { clock, lock } = setup();
  for (let i = 0; i < 3; i++) lock.noteFail("old");
  clock.t += 61000;
  for (let i = 0; i < 3; i++) lock.noteFail("new");
  lock.sweep();
  assert.equal(lock.lockedFor("old"), 0);
  assert.ok(lock.lockedFor("new") > 0);
});

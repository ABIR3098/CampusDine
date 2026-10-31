const test = require("node:test");
const assert = require("node:assert/strict");
const catchAsync = require("../src/utils/catchAsync");

test("catchAsync passes a rejected promise to next() instead of crashing", async () => {
  const boom = new Error("boom");
  let received;
  await catchAsync(async () => { throw boom; })({}, {}, (err) => { received = err; });
  assert.equal(received, boom);
});

test("catchAsync does not call next() when the handler succeeds", async () => {
  let called = false;
  await catchAsync(async (req, res) => { res.done = true; })({}, {}, () => { called = true; });
  assert.equal(called, false);
});

test("catchAsync also catches errors thrown by a non-async handler", async () => {
  let received;
  catchAsync(() => Promise.reject(new Error("late")))({}, {}, (err) => { received = err; });
  await new Promise((r) => setImmediate(r));
  assert.equal(received.message, "late");
});

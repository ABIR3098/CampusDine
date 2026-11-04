const test = require("node:test");
const assert = require("node:assert/strict");
const { startRiderDispatchTimer, dispatchSeconds, DEFAULT_SECONDS } = require("../src/services/riderDispatchTimer");

test("RIDER_DISPATCH_SECONDS: empty or unset means 20 seconds", () => {
  assert.equal(DEFAULT_SECONDS, 20);
  for (const value of [undefined, null, "", "  "]) assert.equal(dispatchSeconds(value), 20);
});

test("RIDER_DISPATCH_SECONDS: 0 turns the timer off and numbers up to 3600 are kept", () => {
  assert.equal(dispatchSeconds("0"), 0);
  assert.equal(dispatchSeconds("45"), 45);
  assert.equal(dispatchSeconds("3600"), 3600);
});

test("RIDER_DISPATCH_SECONDS: nonsense falls back to 20", () => {
  for (const value of ["abc", "-5", "2.5", "3601", "NaN"]) assert.equal(dispatchSeconds(value), 20);
});

test("the timer asks the dispatcher to run, with the io, every N seconds", () => {
  const calls = [];
  const dispatcher = { dispatchQuietly: (options) => calls.push(options) };
  const io = { name: "io" };
  let tick = null;
  let delay = null;
  const handle = { unrefCalled: false, unref() { this.unrefCalled = true; } };
  const result = startRiderDispatchTimer({
    dispatcher, io, seconds: 30,
    setIntervalFn: (fn, ms) => { tick = fn; delay = ms; return handle; },
  });
  assert.equal(result, handle);
  assert.equal(delay, 30000);
  assert.equal(handle.unrefCalled, true);
  tick();
  tick();
  assert.deepEqual(calls, [{ io }, { io }]);
});

test("with 0 seconds no timer is created", () => {
  let created = false;
  const result = startRiderDispatchTimer({ dispatcher: {}, io: {}, seconds: 0, setIntervalFn: () => { created = true; } });
  assert.equal(result, null);
  assert.equal(created, false);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const TableBookingService = require("../src/services/tableBookingService");

test("TableBookingService.generateTableQrToken generates valid verifiable token", () => {
  const token = TableBookingService.generateTableQrToken(5);
  assert.match(token, /^CD-TBL-5-[A-Z0-9]+$/);

  const verification = TableBookingService.verifyTableQrToken(token);
  assert.equal(verification.isValid, true);
  assert.equal(verification.tableNo, 5);
});

test("TableBookingService.verifyTableQrToken rejects invalid format", () => {
  const result = TableBookingService.verifyTableQrToken("RANDOM-TOKEN-123");
  assert.equal(result.isValid, false);
  assert.equal(result.tableNo, null);
});

test("TableBookingService.getOccupancyMetrics calculates seat statistics", () => {
  const metrics = TableBookingService.getOccupancyMetrics();
  assert.equal(metrics.totalTables, 8);
  assert.ok(metrics.totalSeats > 0);
  assert.equal(typeof metrics.occupancyRate, "number");
  assert.equal(typeof metrics.isRushHour, "boolean");
});

test("TableBookingService.createReservation creates confirmed reservation with validation", () => {
  const res = TableBookingService.createReservation({
    studentId: "STU-1002",
    studentName: "Adnan Sami",
    tableNo: 3,
    partySize: 4
  });

  assert.match(res.reservationId, /^RES-\d+$/);
  assert.equal(res.status, "CONFIRMED");
  assert.equal(res.partySize, 4);

  assert.throws(() => {
    TableBookingService.createReservation({ studentId: "STU-1", tableNo: 1, partySize: 20 });
  }, /Party size must be between 1 and 12/);
});

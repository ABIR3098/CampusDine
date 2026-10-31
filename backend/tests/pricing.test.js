process.env.CANTEEN_TZ = "Asia/Dhaka"; // the tests below use Dhaka wall-clock times
const test = require("node:test");
const assert = require("node:assert/strict");
const { r2, isHappyHourActive, happyHourCovers } = require("../src/pricing");

const hh = (over = {}) => ({ is_active: 1, start_time: "14:00", end_time: "16:00", days: [], itemIds: [], category: null, ...over });
// Dhaka is UTC+6, so 09:00Z is 15:00 in Dhaka. 2026-10-31 is a Saturday (dow 6).
const at = (iso) => new Date(iso);

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPayload, parseCode, sign } = require("../src/utils/tokenQr");

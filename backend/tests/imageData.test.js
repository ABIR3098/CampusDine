const test = require("node:test");
const assert = require("node:assert/strict");
const { isSafeImageDataUrl, MAX_IMAGE_DATA_LENGTH } = require("../src/utils/imageData");

test("accepts png, jpg, jpeg and webp data URLs", () => {
  for (const type of ["png", "jpg", "jpeg", "webp"]) {
    assert.equal(isSafeImageDataUrl(`data:image/${type};base64,iVBORw0KGgo=`), true, type);
  }
});

test("rejects a value that breaks out of the src attribute", () => {
  const attack = 'data:image/png;base64,x" onerror="alert(1)" data-x="';
  assert.equal(isSafeImageDataUrl(attack), false);
});

test("rejects angle brackets, spaces and newlines after the prefix", () => {
  assert.equal(isSafeImageDataUrl("data:image/png;base64,AAA<script>"), false);
  assert.equal(isSafeImageDataUrl("data:image/png;base64,AAA BBB"), false);
  assert.equal(isSafeImageDataUrl("data:image/png;base64,AAA\nBBB"), false);
});

test("rejects other types and an empty body", () => {
  assert.equal(isSafeImageDataUrl("data:image/svg+xml;base64,AAAA"), false);
  assert.equal(isSafeImageDataUrl("data:text/html;base64,AAAA"), false);
  assert.equal(isSafeImageDataUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageDataUrl("data:image/png;base64,"), false);
});

test("rejects non-strings and values that are too long", () => {
  assert.equal(isSafeImageDataUrl(null), false);
  assert.equal(isSafeImageDataUrl(123), false);
  const tooLong = "data:image/png;base64," + "A".repeat(MAX_IMAGE_DATA_LENGTH);
  assert.equal(isSafeImageDataUrl(tooLong), false);
});

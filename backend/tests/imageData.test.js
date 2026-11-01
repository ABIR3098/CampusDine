const test = require("node:test");
const assert = require("node:assert/strict");
const { isSafeImageDataUrl } = require("../src/utils/imageData");

test("accepts png, jpeg, jpg and webp data URLs", () => {
  for (const kind of ["png", "jpeg", "jpg", "webp"]) {
    assert.equal(isSafeImageDataUrl(`data:image/${kind};base64,iVBORw0KGgo=`), true, kind);
  }
});

test("accepts base64 padding of one or two = signs", () => {
  assert.equal(isSafeImageDataUrl("data:image/png;base64,QUJD"), true);
  assert.equal(isSafeImageDataUrl("data:image/png;base64,QUI="), true);
  assert.equal(isSafeImageDataUrl("data:image/png;base64,QQ=="), true);
});

test("rejects an attribute break-out payload that only STARTS like an image", () => {
  const payload = 'data:image/png;base64,AAAA" onerror="alert(1)" x="';
  assert.equal(isSafeImageDataUrl(payload), false);
});

test("rejects svg, gif and other types", () => {
  assert.equal(isSafeImageDataUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isSafeImageDataUrl("data:image/gif;base64,R0lGOD=="), false);
  assert.equal(isSafeImageDataUrl("data:text/html;base64,PGgxPg=="), false);
});

test("rejects whitespace, newlines and quotes inside the body", () => {
  assert.equal(isSafeImageDataUrl("data:image/png;base64,AA AA"), false);
  assert.equal(isSafeImageDataUrl("data:image/png;base64,AAAA\nBBBB"), false);
  assert.equal(isSafeImageDataUrl("data:image/png;base64,AA'AA"), false);
});

test("rejects an empty body and a missing prefix", () => {
  assert.equal(isSafeImageDataUrl("data:image/png;base64,"), false);
  assert.equal(isSafeImageDataUrl("iVBORw0KGgo="), false);
  assert.equal(isSafeImageDataUrl("http://example.com/a.png"), false);
});

test("rejects values that are not strings", () => {
  for (const v of [null, undefined, 123, {}, [], true]) assert.equal(isSafeImageDataUrl(v), false);
});

test("rejects a string longer than the limit", () => {
  const body = "A".repeat(20);
  assert.equal(isSafeImageDataUrl(`data:image/png;base64,${body}`, 100), true);
  assert.equal(isSafeImageDataUrl(`data:image/png;base64,${body}`, 30), false);
});

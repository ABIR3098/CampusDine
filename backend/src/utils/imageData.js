// Checks an image that arrives as a data URL, e.g. "data:image/png;base64,iVBORw0...".
//
// The whole string must be a data URL with a base64 body. Checking only the start of the string
// is not enough: a value like  data:image/png;base64,AAAA" onerror="...  starts correctly but can
// break out of an HTML attribute when a page prints it.
const ALLOWED = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const DEFAULT_MAX_CHARS = 2800000; // about 2 MB of image once base64-encoded

function isSafeImageDataUrl(value, maxChars = DEFAULT_MAX_CHARS) {
  if (typeof value !== "string" || value.length > maxChars) return false;
  return ALLOWED.test(value);
}

module.exports = { isSafeImageDataUrl, DEFAULT_MAX_CHARS };

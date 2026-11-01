// Checks an image sent as a data URL (Lost & Found photo).
// The whole string must match: a prefix check alone lets a value such as
//   data:image/png;base64,x" onerror="..."
// through, and that text ends up inside an HTML attribute in the Hall Admin page.
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

// 2,800,000 characters is about 2 MB of image once decoded.
const MAX_IMAGE_DATA_LENGTH = 2800000;

function isSafeImageDataUrl(value) {
  return typeof value === "string" && value.length <= MAX_IMAGE_DATA_LENGTH && IMAGE_DATA_URL.test(value);
}

module.exports = { isSafeImageDataUrl, MAX_IMAGE_DATA_LENGTH };

"use strict";
// Pure rules for the teacher <-> rider chat. Nothing here touches the database,
// so every rule can be tested on its own.

const MAX_MESSAGE_LENGTH = 2000;

// Trim a message and check its length. Returns { text } or { error }.
function cleanMessage(raw) {
  const text = String(raw == null ? "" : raw).replace(/\r\n/g, "\n").trim();
  if (!text) return { error: "Message cannot be empty" };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };
  }
  return { text };
}

module.exports = { MAX_MESSAGE_LENGTH, cleanMessage };

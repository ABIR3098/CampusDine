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

// A teacher talks to riders and a rider talks to teachers. Nobody else is in this chat.
const PEER_ROLE = { teacher: "rider", rider: "teacher" };
const CHAT_ROLES = Object.keys(PEER_ROLE);

const peerRoleOf = (role) => PEER_ROLE[role] || null;
const canChat = (roleA, roleB) => PEER_ROLE[roleA] === roleB;

// Turn "me" and "the other person" into the { teacherId, riderId } pair a thread is stored under.
function pairOf(me, peer) {
  if (!me || !peer || !canChat(me.role, peer.role)) return null;
  return me.role === "teacher"
    ? { teacherId: Number(me.id), riderId: Number(peer.id) }
    : { teacherId: Number(peer.id), riderId: Number(me.id) };
}

// A positive whole number from a URL or body value, or null.
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// The words next to a chat in the list: the text, or a note when it was deleted.
function previewOf(message, deleted) {
  if (deleted) return "Message deleted";
  const flat = String(message || "").replace(/\s+/g, " ").trim();
  return flat.length > 80 ? flat.slice(0, 77) + "..." : flat;
}

module.exports = { MAX_MESSAGE_LENGTH, CHAT_ROLES, cleanMessage, peerRoleOf, canChat, pairOf, parseId, previewOf };

// chat-upgrade12.js -- run from the project root:  node chat-upgrade12.js
// Makes "Photo upload failed" tell you the real reason (server not restarted, database limit, not logged in, ...).
// Changes: frontend/campusdine.html and backend/src/routes/chat.js. Run AFTER chat-upgrade11.js. Safe to run twice.
const fs = require("fs"), path = require("path");
const F = { fe: path.join(__dirname, "frontend", "campusdine.html"), chat: path.join(__dirname, "backend", "src", "routes", "chat.js") };
for (const f of Object.values(F)) if (!fs.existsSync(f)) { console.error(f + " not found. Run this from the project root folder."); process.exit(1); }
const read = (f) => { const raw = fs.readFileSync(f, "utf8"); return { raw, crlf: raw.includes("\r\n"), text: raw.replace(/\r\n/g, "\n") }; };
const save = (f, o, text) => { if (!fs.existsSync(f + ".bak12")) fs.writeFileSync(f + ".bak12", o.raw); fs.writeFileSync(f, o.crlf ? text.replace(/\n/g, "\r\n") : text); };
const O = { fe: read(F.fe), chat: read(F.chat) };
let html = O.fe.text, chat = O.chat.text;
if (!html.includes("/*chat-ui11*/") || !chat.includes("chat_images")) { console.error("Run chat-upgrade11.js first. Nothing changed."); process.exit(1); }
const count = (t, x) => t.split(x).length - 1;
const H = '    if (!res.ok) throw new Error(data.error || "Photo upload failed");\n';
const S = '      console.error("Failed to save chat photo:", error);\n      res.status(500).json({ error: "Photo upload failed" });\n';
let changed = false;
if (count(html, H) === 1) {
  html = html.replace(H, () => `    if (!res.ok) {
      if (data.error) throw new Error(data.error);
      if (res.status === 404 || res.status === 405) throw new Error("Photo upload is not available yet. Restart the server, then refresh the page (Ctrl + Shift + R).");
      if (res.status === 401 || res.status === 403) throw new Error("Please log in again to send photos.");
      throw new Error("Photo upload failed (error " + res.status + ").");
    }
`);
  changed = true;
} else if (!html.includes("Photo upload is not available yet")) { console.error("campusdine.html: expected code not found. Nothing changed."); process.exit(1); }
if (count(chat, S) === 1) {
  chat = chat.replace(S, () => `      console.error("Failed to save chat photo:", error);
      const code = error && error.code;
      if (code === "ER_NET_PACKET_TOO_LARGE") return res.status(413).json({ error: "The database refused this photo (max_allowed_packet is too small). Try a smaller photo." });
      if (code === "ER_NO_SUCH_TABLE") return res.status(500).json({ error: "Photo storage is not ready. Restart the server and try again." });
      if (error && (error.errno === 139 || code === "ER_TOO_BIG_ROWSIZE")) return res.status(500).json({ error: "The database cannot store this photo (increase innodb_log_file_size). Try a smaller photo." });
      res.status(500).json({ error: "Photo upload failed" + (code ? " (" + code + ")" : "") });
`);
  changed = true;
} else if (!chat.includes("max_allowed_packet is too small")) { console.error("backend chat.js: expected code not found. Nothing changed."); process.exit(1); }
if (!changed) { console.log("Already applied, nothing to do."); process.exit(0); }
save(F.fe, O.fe, html); save(F.chat, O.chat, chat);
console.log("Done: clearer photo errors. Backups: *.bak12 next to each changed file.");

// "Notify me" — tells students who asked about an item that it is available again.
// Sends a socket nudge to each waiting student; the app then fetches /api/menu/alerts and shows the notification.
const pool = require("./db");

async function pingWatchers(io, itemIds) {
  if (!io || !itemIds || itemIds.length === 0) return 0;
  const [rows] = await pool.query(
    `SELECT DISTINCT a.user_id
     FROM stock_alerts a JOIN menu_items m ON m.id = a.menu_item_id
     WHERE a.menu_item_id IN (${itemIds.map(() => "?").join(",")}) AND m.stock > 0 AND m.availability = 'available'`,
    itemIds
  );
  for (const r of rows) io.to(`user:${r.user_id}`).emit("menu:restocked");
  return rows.length;
}

module.exports = { pingWatchers };

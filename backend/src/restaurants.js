// Which restaurant a menu item belongs to — without touching the database schema.
// Built-in items are mapped by name in catalog.js. Items an admin adds later are
// remembered here in the existing app_meta key/value table ("item_restaurant_<id>").
const pool = require("./db");

const KEY_PREFIX = "item_restaurant_";

// → { [menu_item_id]: restaurantId }
async function loadItemRestaurants(db = pool) {
  try {
    const [rows] = await db.query("SELECT meta_key, meta_value FROM app_meta WHERE meta_key LIKE ?", [`${KEY_PREFIX}%`]);
    const map = {};
    for (const row of rows) map[Number(row.meta_key.slice(KEY_PREFIX.length))] = row.meta_value;
    return map;
  } catch (e) {
    return {}; // app_meta is created on server start; if it is missing, fall back to the name map
  }
}

async function saveItemRestaurant(menuItemId, restaurantId, db = pool) {
  await db.query(
    "INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)",
    [`${KEY_PREFIX}${menuItemId}`, restaurantId]
  );
}

module.exports = { loadItemRestaurants, saveItemRestaurant };

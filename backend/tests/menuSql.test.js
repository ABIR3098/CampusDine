const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(path.join(__dirname, "..", "more_menu_items.sql"), "utf8");
const [itemsPart, restaurantPart] = sql.split("-- 2) which restaurant");
const names = (part) => [...part.matchAll(/SELECT '([^']+)'/g)].map((m) => m[1]);
const itemNames = names(itemsPart);
const restaurantPairs = [...restaurantPart.matchAll(/SELECT '([^']+)'(?: AS name)?, '([a-z]+)'/g)].map((m) => [m[1], m[2]]);

test("more_menu_items.sql lists every item in both blocks, once", () => {
  assert.strictEqual(new Set(itemNames).size, itemNames.length, "duplicate item name in the items block");
  assert.deepStrictEqual([...restaurantPairs.map((p) => p[0])].sort(), [...itemNames].sort());
});

test("every item in more_menu_items.sql has a valid restaurant", () => {
  const valid = ["amitie", "vista", "thirdplace", "staff"];
  for (const [name, restaurant] of restaurantPairs) assert.ok(valid.includes(restaurant), name + ": " + restaurant);
});

test("every image used in more_menu_items.sql exists in frontend/images/food", () => {
  for (const m of itemsPart.matchAll(/'(\/images\/food\/[a-z-]+\.svg)'/g)) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", "..", "frontend", m[1])), "missing " + m[1]);
  }
});

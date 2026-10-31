const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  IMAGE_BY_NAME, ITEMS_BY_RESTAURANT, RESTAURANTS, DEFAULT_RESTAURANT,
  restaurantOf, isRestaurantId, menuRank, nutritionFor,
} = require("../src/catalog");

test("isRestaurantId accepts the four restaurants only", () => {
  for (const r of RESTAURANTS) assert.strictEqual(isRestaurantId(r.id), true);
  assert.strictEqual(RESTAURANTS.length, 4);
  assert.strictEqual(isRestaurantId("pizza-hut"), false);
  assert.strictEqual(isRestaurantId(""), false);
});

test("restaurantOf uses the built-in list, an admin override, then the default", () => {
  assert.strictEqual(restaurantOf("Khichuri"), "staff");
  assert.strictEqual(restaurantOf("Khichuri", 7, { 7: "vista" }), "vista");
  assert.strictEqual(restaurantOf("Unknown dish", 99, {}), DEFAULT_RESTAURANT);
});

test("every built-in item belongs to a known restaurant", () => {
  for (const id of Object.keys(ITEMS_BY_RESTAURANT)) assert.strictEqual(isRestaurantId(id), true);
});

test("menuRank follows the list order", () => {
  const [first, second] = ITEMS_BY_RESTAURANT.staff;
  assert.strictEqual(menuRank(first), 0);
  assert.strictEqual(menuRank(second), 1);
});

test("nutritionFor returns empty info for unlisted items", () => {
  assert.deepStrictEqual(nutritionFor("Unknown dish"), { calories: null, allergens: [] });
});

test("every item image file exists in frontend/images/food", () => {
  for (const [name, img] of Object.entries(IMAGE_BY_NAME)) {
    const file = path.join(__dirname, "..", "..", "frontend", img);
    assert.ok(fs.existsSync(file), `${name}: missing ${img}`);
  }
});

test("nutrition entries have non-negative calories and known allergens", () => {
  const { NUTRITION_BY_NAME } = require("../src/catalog");
  const known = ["egg", "milk", "gluten", "fish", "nuts", "soy"];
  for (const [name, info] of Object.entries(NUTRITION_BY_NAME)) {
    assert.ok(Number.isFinite(info.calories) && info.calories >= 0, name + ": bad calories");
    for (const a of info.allergens) assert.ok(known.includes(a), name + ": unknown allergen " + a);
  }
});

test("every nutrition entry matches a built-in item or one in more_menu_items.sql", () => {
  const { NUTRITION_BY_NAME } = require("../src/catalog");
  const sql = fs.readFileSync(path.join(__dirname, "..", "more_menu_items.sql"), "utf8");
  for (const name of Object.keys(NUTRITION_BY_NAME)) {
    assert.ok(name in IMAGE_BY_NAME || sql.includes("SELECT '" + name + "'"), name + " is not a known item");
  }
});

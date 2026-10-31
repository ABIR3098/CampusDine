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

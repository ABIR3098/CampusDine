const test = require("node:test");
const assert = require("node:assert/strict");
const RecipeDepletionService = require("../src/services/recipeDepletionService");

test("RecipeDepletionService.calculateDepletion calculates ingredients for 2 Biryanis", () => {
  const items = [{ name: "Special Chicken Biryani", qty: 2 }];
  const depletion = RecipeDepletionService.calculateDepletion(items);

  const rice = depletion.find((d) => d.ingredient === "Basmati Rice");
  const chicken = depletion.find((d) => d.ingredient === "Broiler Chicken");

  assert.ok(rice, "Basmati rice must be depleted");
  assert.equal(rice.totalQuantityNeeded, 0.40);
  assert.ok(chicken, "Chicken must be depleted");
  assert.equal(chicken.totalQuantityNeeded, 0.36);
});

test("RecipeDepletionService.calculateDepletion handles unlisted custom items gracefully", () => {
  const items = [{ name: "Custom Special Juice", qty: 1 }];
  const depletion = RecipeDepletionService.calculateDepletion(items);
  assert.equal(depletion.length, 0);
});

test("RecipeDepletionService.isLowStock triggers warning when at or below threshold", () => {
  assert.equal(RecipeDepletionService.isLowStock(5, 10), true);
  assert.equal(RecipeDepletionService.isLowStock(10, 10), true);
  assert.equal(RecipeDepletionService.isLowStock(25, 10), false);
});

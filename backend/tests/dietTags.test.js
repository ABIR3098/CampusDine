const test = require("node:test");
const assert = require("node:assert");
const { tagsOf, parseList, matchesFor } = require("../src/hall/dietTags");

test("tagsOf finds English and Bangla words", () => {
  assert.deepStrictEqual(tagsOf("Rice, Dal, Beef curry"), ["beef"]);
  assert.deepStrictEqual(tagsOf("ইলিশ মাছ"), ["fish"]);
});

test("tagsOf returns nothing for empty or unrelated text", () => {
  assert.deepStrictEqual(tagsOf(""), []);
  assert.deepStrictEqual(tagsOf(null), []);
  assert.deepStrictEqual(tagsOf("Rice, Dal"), []);
});

test("parseList drops unknown words and duplicates", () => {
  assert.deepStrictEqual(parseList("beef, fish, beef, pizza"), ["beef", "fish"]);
  assert.deepStrictEqual(parseList(["egg", " egg "]), ["egg"]);
});

test("matchesFor: allergy wins over avoid", () => {
  const diet = { allergies: ["egg"], avoid: ["egg", "beef"] };
  assert.deepStrictEqual(matchesFor(["egg", "beef"], diet).map((m) => m.level), ["allergy", "avoid"]);
});

test("tagsOf does not tag eggplant as egg, and tags butter as dairy", () => {
  const { tagsOf } = require("../src/hall/dietTags");
  assert.deepStrictEqual(tagsOf("Eggplant bhaji"), []);
  assert.deepStrictEqual(tagsOf("Butter chicken").sort(), ["chicken", "milk"]);
});

test("tagsOf finds mutton, shellfish, nuts, dairy and egg words", () => {
  const { tagsOf } = require("../src/hall/dietTags");
  assert.deepStrictEqual(tagsOf("Khashi curry"), ["mutton"]);
  assert.deepStrictEqual(tagsOf("Chingri malai"), ["shellfish"]);
  assert.deepStrictEqual(tagsOf("Badam sharbat"), ["nuts"]);
  assert.deepStrictEqual(tagsOf("Mishti doi"), ["milk"]);
  assert.deepStrictEqual(tagsOf("Dim bhuna"), ["egg"]);
});

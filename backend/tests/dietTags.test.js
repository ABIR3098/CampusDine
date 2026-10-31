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

test("tagsOf finds chicken", () => {
  assert.deepEqual(tagsOf("Rice, Chicken curry"), ["chicken"]);
});

test("tagsOf finds mutton by its Banglish name", () => {
  assert.deepEqual(tagsOf("Khashi bhuna, Polao"), ["mutton"]);
});

test("tagsOf finds fish", () => {
  assert.deepEqual(tagsOf("Ilish bhat"), ["fish"]);
});

test("tagsOf finds prawn as shellfish", () => {
  assert.deepEqual(tagsOf("Prawn curry"), ["shellfish"]);
});

test("tagsOf finds egg, including the Banglish word dim", () => {
  assert.deepEqual(tagsOf("Porota, Mixed veg, Egg"), ["egg"]);
  assert.deepEqual(tagsOf("Dim bhuna"), ["egg"]);
});

test("tagsOf finds milk and dairy dishes", () => {
  assert.deepEqual(tagsOf("Payesh"), ["milk"]);
  assert.deepEqual(tagsOf("Mishti doi"), ["milk"]);
});

test("tagsOf finds nuts", () => {
  assert.deepEqual(tagsOf("Peanut chikki"), ["nuts"]);
});

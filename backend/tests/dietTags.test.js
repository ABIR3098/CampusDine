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

test("tagsOf understands Bangla words", () => {
  assert.deepEqual(tagsOf("গরুর মাংস"), ["beef"]);
  assert.deepEqual(tagsOf("ইলিশ মাছ"), ["fish"]);
});

test("tagsOf returns nothing for a plain meal or empty input", () => {
  assert.deepEqual(tagsOf("Rice, Dal"), []);
  assert.deepEqual(tagsOf(""), []);
  assert.deepEqual(tagsOf(null), []);
});

test("tagsOf returns several tags in the fixed tag order", () => {
  assert.deepEqual(tagsOf("Egg, Rice, Beef curry"), ["beef", "egg"]);
});

test("parseList reads a comma list and drops unknown words", () => {
  assert.deepEqual(parseList("beef, fish,pizza"), ["beef", "fish"]);
});

test("parseList accepts an array and removes duplicates", () => {
  assert.deepEqual(parseList(["beef", "beef", "egg"]), ["beef", "egg"]);
  assert.deepEqual(parseList(null), []);
});

// What is in a meal? The menu is plain text ("Rice, Dal, Beef curry"), so the tags are found by looking for
// well-known words (English and Bangla/Banglish). It is a helper, not a guarantee: the screens say so.
const TAGS = [
  { key: "beef", label: "Beef", re: /beef|gorur|গরু/i },
  { key: "chicken", label: "Chicken", re: /chicken|murgi|মুরগি/i },
  { key: "mutton", label: "Mutton / goat", re: /mutton|khashi|khasi|goat|খাসি|ছাগল/i },
  { key: "fish", label: "Fish", re: /fish|ilish|hilsa|\brui\b|katla|pangas|pabda|tilapia|shutki|maach|\bmach\b|ইলিশ|মাছ/i },
  { key: "shellfish", label: "Prawn / shellfish", re: /prawn|shrimp|chingri|crab|চিংড়ি/i },
  { key: "egg", label: "Egg", re: /\beggs?\b|omelet|omelette|\bdim\b|ডিম/i },
  { key: "milk", label: "Milk & dairy", re: /milk|\bdoi\b|dahi|curd|yogh?urt|payesh|payes|kheer|firni|cheese|\bghee\b|butter|দুধ|দই|পায়েস/i },
  { key: "nuts", label: "Nuts", re: /peanut|\bnuts?\b|badam|almond|cashew|pista|বাদাম/i },
];
const KEYS = TAGS.map((t) => t.key);
const LABEL = Object.fromEntries(TAGS.map((t) => [t.key, t.label]));
const VEGETARIAN_AVOID = ["beef", "chicken", "mutton", "fish", "shellfish"]; // the "Vegetarian" shortcut (egg and dairy are allowed)

// "Rice, Dal, Beef curry" → ["beef"]
function tagsOf(text) {
  const s = String(text || "");
  return TAGS.filter((t) => t.re.test(s)).map((t) => t.key);
}

// "beef,fish" (or an array) → ["beef", "fish"]; unknown words are dropped
function parseList(v) {
  const list = Array.isArray(v) ? v : String(v || "").split(",");
  return [...new Set(list.map((x) => String(x).trim()).filter((x) => KEYS.includes(x)))];
}

// which of a person's tags a meal hits → [{ key, label, level: "allergy" | "avoid" }]  (allergy wins when both)
function matchesFor(mealTags, diet) {
  const out = [];
  for (const key of mealTags) {
    if (diet.allergies.includes(key)) out.push({ key, label: LABEL[key], level: "allergy" });
    else if (diet.avoid.includes(key)) out.push({ key, label: LABEL[key], level: "avoid" });
  }
  return out;
}

module.exports = { TAGS, KEYS, LABEL, VEGETARIAN_AVOID, tagsOf, parseList, matchesFor };

// Menu catalogue: image for every item (served locally from frontend/images/food,
// so nothing is loaded from the internet) and the extra items added in v2.
const IMG = (slug) => `/images/food/${slug}.svg`;

// name -> image path (used to fill menu_items.image when it is empty)
const IMAGE_BY_NAME = {
  "Khichuri": IMG("khichuri"), "Tehari": IMG("tehari"), "Porota-Vaji": IMG("porota-vaji"),
  "Plain Rice & Dal": IMG("rice-dal"), "Singara": IMG("singara"), "Fuchka": IMG("fuchka"),
  "Chicken Roll": IMG("chicken-roll"), "Cha (Tea)": IMG("cha"), "Lassi": IMG("lassi"),
  "Mineral Water": IMG("mineral-water"),
  "Chicken Biryani": IMG("chicken-biryani"), "Beef Bhuna & Rice": IMG("beef-bhuna"),
  "Egg Curry & Rice": IMG("egg-curry"), "Fish Curry & Rice": IMG("fish-curry"),
  "Mixed Veg & Rice": IMG("mixed-veg-rice"), "Fried Rice": IMG("fried-rice"), "Chowmein": IMG("chowmein"),
  "Chotpoti": IMG("chotpoti"), "Jhalmuri": IMG("jhalmuri"), "French Fries": IMG("french-fries"),
  "Chicken Burger": IMG("chicken-burger"), "Egg Sandwich": IMG("egg-sandwich"), "Veg Pakora": IMG("veg-pakora"),
  "Cold Coffee": IMG("cold-coffee"), "Mango Juice": IMG("mango-juice"), "Lemon Soda": IMG("lemon-soda"),
  "Borhani": IMG("borhani"), "Falooda": IMG("falooda"), "Coconut Water": IMG("coconut-water"),
};

// Nutrition info shown on the menu cards. Values are approximate (per serving) and are kept
// here, next to the images, so no database change is needed. Items an admin adds later that
// are not listed here simply show no nutrition badges.
// allergen keys: egg | milk | gluten | fish | nuts | soy
const NUTRITION_BY_NAME = {
  "Khichuri": { calories: 450, allergens: ["milk"] },
  "Tehari": { calories: 650, allergens: [] },
  "Porota-Vaji": { calories: 420, allergens: ["gluten"] },
  "Plain Rice & Dal": { calories: 380, allergens: [] },
  "Singara": { calories: 260, allergens: ["gluten"] },
  "Fuchka": { calories: 220, allergens: ["gluten"] },
  "Chicken Roll": { calories: 380, allergens: ["gluten", "egg"] },
  "Cha (Tea)": { calories: 60, allergens: ["milk"] },
  "Lassi": { calories: 150, allergens: ["milk"] },
  "Mineral Water": { calories: 0, allergens: [] },
  "Chicken Biryani": { calories: 600, allergens: ["milk"] },
  "Beef Bhuna & Rice": { calories: 650, allergens: [] },
  "Egg Curry & Rice": { calories: 520, allergens: ["egg"] },
  "Fish Curry & Rice": { calories: 500, allergens: ["fish"] },
  "Mixed Veg & Rice": { calories: 420, allergens: [] },
  "Fried Rice": { calories: 480, allergens: ["egg", "soy"] },
  "Chowmein": { calories: 450, allergens: ["gluten", "egg", "soy"] },
  "Chotpoti": { calories: 250, allergens: ["egg"] },
  "Jhalmuri": { calories: 150, allergens: ["nuts"] },
  "French Fries": { calories: 320, allergens: [] },
  "Chicken Burger": { calories: 480, allergens: ["gluten", "egg", "milk"] },
  "Egg Sandwich": { calories: 300, allergens: ["gluten", "egg"] },
  "Veg Pakora": { calories: 200, allergens: [] },
  "Cold Coffee": { calories: 180, allergens: ["milk"] },
  "Mango Juice": { calories: 120, allergens: [] },
  "Lemon Soda": { calories: 90, allergens: [] },
  "Borhani": { calories: 80, allergens: ["milk"] },
  "Falooda": { calories: 320, allergens: ["milk", "nuts"] },
  "Coconut Water": { calories: 45, allergens: [] },
  "Club Sandwich": { calories: 450, allergens: ["gluten", "egg", "milk"] },
  "Grilled Chicken Sandwich": { calories: 420, allergens: ["gluten", "milk"] },
  "Cheese Fries": { calories: 450, allergens: ["milk"] },
  "Cappuccino": { calories: 120, allergens: ["milk"] },
  "Hot Chocolate": { calories: 200, allergens: ["milk"] },
  "Chocolate Milkshake": { calories: 350, allergens: ["milk"] },
  "Beguni": { calories: 90, allergens: [] },
  "Piyaju": { calories: 90, allergens: [] },
  "Alur Chop": { calories: 140, allergens: [] },
  "Egg Chop": { calories: 220, allergens: ["egg", "gluten"] },
  "Haleem": { calories: 380, allergens: ["gluten"] },
  "Sugarcane Juice": { calories: 180, allergens: [] },
  "Chicken Fried Rice": { calories: 520, allergens: ["egg", "soy"] },
  "Beef Tehari": { calories: 680, allergens: [] },
  "Chicken Pasta": { calories: 550, allergens: ["gluten", "milk"] },
  "Thai Soup": { calories: 90, allergens: ["soy"] },
  "Orange Juice": { calories: 110, allergens: [] },
  "Watermelon Juice": { calories: 90, allergens: [] },
  "Chicken Curry & Rice": { calories: 560, allergens: [] },
  "Dal Sobji & Rice": { calories: 420, allergens: [] },
  "Ilish Bhat": { calories: 600, allergens: ["fish"] },
  "Egg Khichuri": { calories: 480, allergens: ["egg", "milk"] },
  "Luchi & Alur Dom": { calories: 450, allergens: ["gluten"] },
  "Mishti Doi": { calories: 200, allergens: ["milk"] },
  "Payesh": { calories: 280, allergens: ["milk", "nuts"] },
  "Vegetable Roll": { calories: 280, allergens: ["gluten"] },
};

// Always returns { calories, allergens } so callers never have to check for undefined.
function nutritionFor(name) {
  const info = NUTRITION_BY_NAME[name];
  return info
    ? { calories: info.calories, allergens: [...info.allergens] }
    : { calories: null, allergens: [] };
}

// ── Restaurants ──────────────────────────────────────────────────────────────
// Campus has four restaurants. To avoid any database change, which restaurant an item
// belongs to is decided here, by item name — each item belongs to exactly one restaurant,
// and the order of each list is the order the items are shown in that restaurant's menu
// (so no two restaurants share a menu or a serial). Items an admin adds later get their
// restaurant stored in app_meta (see src/restaurants.js); anything unassigned falls back
// to DEFAULT_RESTAURANT.
const RESTAURANTS = [
  { id: "amitie", name: "Amitié", subtitle: "Friendship" },
  { id: "vista", name: "Vista Cafeteria", subtitle: "" },
  { id: "thirdplace", name: "Third Place", subtitle: "" },
  { id: "staff", name: "Staff Canteen", subtitle: "" },
];
const DEFAULT_RESTAURANT = "amitie";

const ITEMS_BY_RESTAURANT = {
  // café: coffee, sandwiches, burgers, sweet drinks
  amitie: ["Egg Sandwich", "Chicken Burger", "French Fries", "Cold Coffee", "Cha (Tea)", "Lassi", "Falooda"],
  // street-food counter: chaat, fried snacks, rolls
  vista: ["Fuchka", "Chotpoti", "Singara", "Veg Pakora", "Chicken Roll", "Jhalmuri", "Lemon Soda"],
  // rice & noodle bowls with cold drinks
  thirdplace: ["Chicken Biryani", "Tehari", "Fried Rice", "Chowmein", "Mango Juice", "Coconut Water", "Mineral Water"],
  // home-style meals
  staff: ["Khichuri", "Plain Rice & Dal", "Beef Bhuna & Rice", "Fish Curry & Rice", "Egg Curry & Rice", "Mixed Veg & Rice", "Porota-Vaji", "Borhani"],
};

const RESTAURANT_BY_ITEM = {};
const RANK_BY_ITEM = {};
for (const [restaurantId, names] of Object.entries(ITEMS_BY_RESTAURANT)) {
  names.forEach((name, index) => { RESTAURANT_BY_ITEM[name] = restaurantId; RANK_BY_ITEM[name] = index; });
}

// extra = { [menu_item_id]: restaurantId } for items an admin added (may be omitted)
function restaurantOf(name, id, extra) {
  if (extra && id != null && extra[id]) return extra[id];
  return RESTAURANT_BY_ITEM[name] || DEFAULT_RESTAURANT;
}

function isRestaurantId(value) {
  return RESTAURANTS.some((r) => r.id === value);
}

// Position of an item inside its restaurant's menu (unlisted items go last).
function menuRank(name) {
  return name in RANK_BY_ITEM ? RANK_BY_ITEM[name] : 999;
}

// [name, name_bn, category, price, stock, tag, is_veg]
const NEW_ITEMS = [
  ["Chicken Biryani", "চিকেন বিরিয়ানি", "heavy", 120, 30, "Popular", 0],
  ["Beef Bhuna & Rice", "গরুর ভুনা-ভাত", "heavy", 130, 25, null, 0],
  ["Egg Curry & Rice", "ডিম ভুনা-ভাত", "heavy", 70, 35, null, 0],
  ["Fish Curry & Rice", "মাছ-ভাত", "heavy", 90, 25, null, 0],
  ["Mixed Veg & Rice", "সবজি-ভাত", "heavy", 55, 35, null, 1],
  ["Fried Rice", "ফ্রাইড রাইস", "heavy", 80, 30, null, 0],
  ["Chowmein", "চাউমিন", "heavy", 70, 30, "New", 1],
  ["Chotpoti", "চটপটি", "snacks", 30, 40, "Popular", 1],
  ["Jhalmuri", "ঝালমুড়ি", "snacks", 20, 50, null, 1],
  ["French Fries", "ফ্রেঞ্চ ফ্রাই", "snacks", 40, 40, null, 1],
  ["Chicken Burger", "চিকেন বার্গার", "snacks", 90, 20, "New", 0],
  ["Egg Sandwich", "ডিম স্যান্ডউইচ", "snacks", 35, 30, null, 0],
  ["Veg Pakora", "সবজি পাকোড়া", "snacks", 20, 45, null, 1],
  ["Cold Coffee", "কোল্ড কফি", "drinks", 50, 30, "Popular", 1],
  ["Mango Juice", "আমের জুস", "drinks", 40, 30, null, 1],
  ["Lemon Soda", "লেবু সোডা", "drinks", 25, 50, null, 1],
  ["Borhani", "বোরহানি", "drinks", 30, 35, null, 1],
  ["Falooda", "ফালুদা", "drinks", 60, 20, "New", 1],
  ["Coconut Water", "ডাবের পানি", "drinks", 40, 25, null, 1],
];

module.exports = {
  IMAGE_BY_NAME, NEW_ITEMS, NUTRITION_BY_NAME, nutritionFor,
  RESTAURANTS, DEFAULT_RESTAURANT, ITEMS_BY_RESTAURANT, restaurantOf, isRestaurantId, menuRank,
};

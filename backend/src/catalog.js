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

module.exports = { IMAGE_BY_NAME, NEW_ITEMS };

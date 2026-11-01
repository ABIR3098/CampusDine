// CampusDine Service: VoiceAssistantService
// Natural language command parser for voice-assisted campus canteen ordering (Bangla & English)

class VoiceAssistantService {
  static KNOWN_DISHES = [
    { name: "Chicken Biryani", bangla: ["বিরিয়ানি", "চিকেন বিরিয়ানি", "বিরিয়ানি"], aliases: ["biryani", "chicken biryani"] },
    { name: "Egg Khichuri", bangla: ["খিচুড়ি", "ডিম খিচুড়ি"], aliases: ["khichuri", "egg khichuri"] },
    { name: "Paratha", bangla: ["পরোটা", "পরটা"], aliases: ["paratha", "porota"] },
    { name: "Beef Tehari", bangla: ["তেহারি", "বিফ তেহারি"], aliases: ["tehari", "beef tehari"] },
    { name: "Singara Combo", bangla: ["সিঙ্গারা", "শিঙ্গাড়া"], aliases: ["singara", "samosa"] },
    { name: "Cold Coffee", bangla: ["কফি", "কোল্ড কফি"], aliases: ["coffee", "cold coffee"] },
    { name: "Borhani", bangla: ["বোরহানি", "বোরহানী"], aliases: ["borhani"] }
  ];

  static BANGLA_NUMBERS = {
    "এক": 1, "একটি": 1, "একটা": 1, "১": 1,
    "দুই": 2, "দুটি": 2, "দুটো": 2, "২": 2,
    "তিন": 3, "তিনটি": 3, "৩": 3,
    "চার": 4, "চারটি": 4, "৪": 4,
    "পাঁচ": 5, "পাঁচটি": 5, "৫": 5
  };

  /**
   * Parses natural language transcript into actionable intent
   * @param {string} text
   * @returns {Object} parsed action
   */
  static parseCommand(text = "") {
    const raw = (text || "").trim().toLowerCase();
    if (!raw) {
      return { intent: "UNKNOWN", message: "No speech recognized" };
    }

    // 1. Checkout intent
    if (raw.includes("checkout") || raw.includes("অর্ডার কনফার্ম") || raw.includes("order confirm") || raw.includes("place order")) {
      return { intent: "CHECKOUT", message: "Proceeding to checkout" };
    }

    // 2. View cart intent
    if (raw.includes("cart") || raw.includes("কার্ট") || raw.includes("ঝুড়ি")) {
      return { intent: "VIEW_CART", message: "Opening cart drawer" };
    }

    // 3. Order status intent
    if (raw.includes("status") || raw.includes("where") || raw.includes("আমার অর্ডার") || raw.includes("খাবার কই")) {
      return { intent: "CHECK_STATUS", message: "Fetching active order status" };
    }

    // 4. Match food dish
    let matchedDish = null;
    for (const dish of this.KNOWN_DISHES) {
      const matchInAliases = dish.aliases.some(a => raw.includes(a));
      const matchInBangla = dish.bangla.some(b => raw.includes(b));
      if (matchInAliases || matchInBangla) {
        matchedDish = dish.name;
        break;
      }
    }

    if (!matchedDish) {
      return {
        intent: "SEARCH_FOOD",
        query: raw,
        message: `Searching canteen menu for "${raw}"`
      };
    }

    // 5. Quantity extraction
    let quantity = 1;
    // Check Bangla numbers
    for (const [word, num] of Object.entries(this.BANGLA_NUMBERS)) {
      if (raw.includes(word)) {
        quantity = num;
        break;
      }
    }
    // Check English digits
    const digitMatch = raw.match(/\b(\d+)\b/);
    if (digitMatch) {
      quantity = parseInt(digitMatch[1], 10);
    }

    return {
      intent: "ADD_TO_CART",
      dishName: matchedDish,
      quantity,
      message: `Added ${quantity}x ${matchedDish} to your cart!`
    };
  }
}

module.exports = VoiceAssistantService;

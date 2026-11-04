// CampusDine Service: LocalizationService
// Translates keys and provides bilingual fallback support (English & Bangla)

class LocalizationService {
  static DICTIONARIES = {
    en: {
      appName: "CampusDine",
      tagline: "Smart Canteen & Dining Ecosystem",
      orderNow: "Order Now",
      cartEmpty: "Your cart is currently empty",
      checkout: "Proceed to Checkout",
      total: "Total",
      deliveryFee: "Delivery Fee",
      vatTax: "VAT & Govt Tax",
      riderTracking: "Live Rider Tracking",
      estimatedArrival: "Estimated Arrival",
      orderPlaced: "Order Placed",
      preparing: "Preparing in Kitchen",
      readyForPickup: "Ready for Pickup",
      delivered: "Delivered",
      loginRequired: "Please sign in to proceed",
      spinWheel: "Daily Spin & Win",
      cleanPlate: "Zero Waste Challenge",
      stockDepleted: "Item out of stock"
    },
    bn: {
      appName: "ক্যাম্পাসডাইন",
      tagline: "স্মার্ট ক্যান্টিন ও ডাইনিং ইকোসিস্টেম",
      orderNow: "এখনই অর্ডার করুন",
      cartEmpty: "আপনার কার্টটি বর্তমানে খালি",
      checkout: "চেকআউট করুন",
      total: "সর্বমোট",
      deliveryFee: "ডেলিভারি চার্জ",
      vatTax: "ভ্যাট ও সরকারি ট্যাক্স",
      riderTracking: "লাইভ রাইডার ট্র্যাকিং",
      estimatedArrival: "সম্ভাব্য পৌঁছানোর সময়",
      orderPlaced: "অর্ডার গ্রহণ করা হয়েছে",
      preparing: "ক্যান্টিন রান্নাঘরে তৈরি হচ্ছে",
      readyForPickup: "সংগ্রহের জন্য প্রস্তুত",
      delivered: "ডেলিভারি সম্পন্ন",
      loginRequired: "অব্যাহত রাখতে সাইন ইন করুন",
      spinWheel: "প্রতিদিনের স্পিন হুইল",
      cleanPlate: "জিরো ওয়েস্ট ফুড চ্যালেঞ্জ",
      stockDepleted: "পণ্যটি বর্তমানে শেষ"
    }
  };

  /**
   * Retrieves translation for a given key and locale
   * @param {string} key
   * @param {string} [locale="en"]
   * @returns {string} translated text
   */
  static t(key, locale = "en") {
    const lang = (locale || "en").toLowerCase();
    const dict = this.DICTIONARIES[lang] || this.DICTIONARIES.en;
    return dict[key] || this.DICTIONARIES.en[key] || key;
  }

  /**
   * Returns list of supported languages
   */
  static getSupportedLocales() {
    return [
      { code: "en", label: "English", flag: "🇬🇧" },
      { code: "bn", label: "বাংলা", flag: "🇧🇩" }
    ];
  }
}

module.exports = LocalizationService;

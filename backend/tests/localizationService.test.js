const test = require("node:test");
const assert = require("node:assert/strict");
const LocalizationService = require("../src/services/localizationService");

test("LocalizationService.t returns English translation by default", () => {
  assert.equal(LocalizationService.t("appName"), "CampusDine");
  assert.equal(LocalizationService.t("orderNow"), "Order Now");
});

test("LocalizationService.t returns Bangla translation when requested", () => {
  assert.equal(LocalizationService.t("appName", "bn"), "ক্যাম্পাসডাইন");
  assert.equal(LocalizationService.t("orderNow", "bn"), "এখনই অর্ডার করুন");
  assert.equal(LocalizationService.t("total", "bn"), "সর্বমোট");
});

test("LocalizationService.t falls back to English when key missing in locale", () => {
  assert.equal(LocalizationService.t("nonExistentKey", "bn"), "nonExistentKey");
});

test("LocalizationService.getSupportedLocales returns available languages", () => {
  const locales = LocalizationService.getSupportedLocales();
  assert.equal(locales.length, 2);
  assert.equal(locales[0].code, "en");
  assert.equal(locales[1].code, "bn");
});

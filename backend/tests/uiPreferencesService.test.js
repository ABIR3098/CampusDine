const test = require("node:test");
const assert = require("node:assert");
const UIPreferencesService = require("../src/services/uiPreferencesService");

test("UIPreferencesService: returns default preferences for new user", () => {
  UIPreferencesService.clearAll();
  const prefs = UIPreferencesService.getPreferences("user_101");
  assert.strictEqual(prefs.theme, "system");
  assert.strictEqual(prefs.enableBottomNav, true);
  assert.strictEqual(prefs.showDietaryBadges, true);
  assert.strictEqual(prefs.compactView, false);
  assert.strictEqual(prefs.soundAlerts, true);
  assert.strictEqual(prefs.language, "en");
});

test("UIPreferencesService: updates valid preferences", () => {
  const updated = UIPreferencesService.updatePreferences("user_101", {
    theme: "dark",
    compactView: true,
    language: "bn"
  });

  assert.strictEqual(updated.theme, "dark");
  assert.strictEqual(updated.compactView, true);
  assert.strictEqual(updated.language, "bn");
  assert.strictEqual(updated.enableBottomNav, true); // preserved
});

test("UIPreferencesService: rejects invalid theme", () => {
  assert.throws(
    () => UIPreferencesService.updatePreferences("user_101", { theme: "neon" }),
    /Invalid theme/
  );
});

test("UIPreferencesService: rejects non-boolean for boolean properties", () => {
  assert.throws(
    () => UIPreferencesService.updatePreferences("user_101", { compactView: "yes" }),
    /must be a boolean/
  );
});

test("UIPreferencesService: resets preferences to defaults", () => {
  UIPreferencesService.updatePreferences("user_102", { theme: "dark" });
  const reset = UIPreferencesService.resetPreferences("user_102");
  assert.strictEqual(reset.theme, "system");
});

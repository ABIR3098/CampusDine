// CampusDine Service: UIPreferencesService
// Manages and persists user interface preferences (theme, navigation, diet badges, layout)

class UIPreferencesService {
  static #store = new Map();

  static DEFAULTS = {
    theme: "system", // "light" | "dark" | "system"
    enableBottomNav: true,
    showDietaryBadges: true,
    compactView: false,
    soundAlerts: true,
    language: "en", // "en" | "bn"
    autoRefreshOrder: true
  };

  static VALID_THEMES = ["light", "dark", "system"];
  static VALID_LANGUAGES = ["en", "bn"];

  static getDefaults() {
    return { ...this.DEFAULTS };
  }

  static getPreferences(userId = "guest") {
    const key = String(userId);
    if (!this.#store.has(key)) {
      this.#store.set(key, { ...this.DEFAULTS });
    }
    return { ...this.#store.get(key) };
  }

  static updatePreferences(userId = "guest", patch = {}) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new Error("Invalid preferences payload: must be a JSON object");
    }

    const current = this.getPreferences(userId);
    const updated = { ...current };

    if ("theme" in patch) {
      if (!this.VALID_THEMES.includes(patch.theme)) {
        throw new Error(`Invalid theme: '${patch.theme}'. Allowed: ${this.VALID_THEMES.join(", ")}`);
      }
      updated.theme = patch.theme;
    }

    if ("language" in patch) {
      if (!this.VALID_LANGUAGES.includes(patch.language)) {
        throw new Error(`Invalid language: '${patch.language}'. Allowed: ${this.VALID_LANGUAGES.join(", ")}`);
      }
      updated.language = patch.language;
    }

    for (const boolProp of ["enableBottomNav", "showDietaryBadges", "compactView", "soundAlerts", "autoRefreshOrder"]) {
      if (boolProp in patch) {
        if (typeof patch[boolProp] !== "boolean") {
          throw new Error(`Property '${boolProp}' must be a boolean`);
        }
        updated[boolProp] = patch[boolProp];
      }
    }

    const key = String(userId);
    this.#store.set(key, updated);
    return { ...updated };
  }

  static resetPreferences(userId = "guest") {
    const key = String(userId);
    const defaults = { ...this.DEFAULTS };
    this.#store.set(key, defaults);
    return defaults;
  }

  static clearAll() {
    this.#store.clear();
  }
}

module.exports = UIPreferencesService;

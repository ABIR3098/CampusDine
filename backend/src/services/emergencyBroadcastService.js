// CampusDine Service: EmergencyBroadcastService
// Handles campus-wide canteen emergency protocols, severe weather alerts, and lockdown broadcasting

class EmergencyBroadcastService {
  static MODES = ["NORMAL", "LIMITED_MENU", "SEVERE_WEATHER", "STRIKE_LOCKDOWN"];

  // In-memory emergency operational state
  static currentState = {
    mode: "NORMAL",
    isActive: false,
    severity: "INFO",
    headline: "Normal Cafeteria Operations",
    instructions: "All campus canteens and delivery riders are operating as usual.",
    updatedAt: new Date().toISOString(),
    updatedBy: "system"
  };

  /**
   * Returns current emergency operational status
   * @returns {Object} status
   */
  static getStatus() {
    return { ...this.currentState };
  }

  /**
   * Sets emergency operational mode and broadcast message
   * @param {Object} payload
   * @returns {Object} updated state
   */
  static setEmergencyState({ mode, headline, instructions, severity = "WARNING", adminId = "admin" }) {
    if (!this.MODES.includes(mode)) {
      throw new Error(`Invalid emergency mode: ${mode}`);
    }

    const isActive = mode !== "NORMAL";

    this.currentState = {
      mode,
      isActive,
      severity,
      headline: headline || `${mode} Activated`,
      instructions: instructions || "Please follow campus cafeteria safety guidelines.",
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };

    return { ...this.currentState };
  }

  /**
   * Checks if delivery is permitted under current emergency conditions
   * @returns {boolean}
   */
  static isDeliveryAllowed() {
    return this.currentState.mode !== "STRIKE_LOCKDOWN" && this.currentState.mode !== "SEVERE_WEATHER";
  }
}

module.exports = EmergencyBroadcastService;

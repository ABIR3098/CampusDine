// CampusDine Service: ExpiryAlertService
// Monitors ingredient expiration dates and generates proactive safety alerts

class ExpiryAlertService {
  /**
   * Evaluates shelf life status for a batch of ingredients
   * @param {Array<{id: string, name: string, expiryDate: string, quantity: number, unit: string}>} batches
   * @param {Date} [referenceDate=new Date()]
   * @returns {Object} status categorization and summary counts
   */
  static evaluateBatches(batches = [], referenceDate = new Date()) {
    const now = new Date(referenceDate).getTime();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const categorized = {
      expired: [],
      critical: [], // <= 3 days
      warning: [],  // <= 7 days
      fresh: []
    };

    batches.forEach(item => {
      const expiry = new Date(item.expiryDate).getTime();
      const daysRemaining = Math.floor((expiry - now) / MS_PER_DAY);

      const entry = {
        ...item,
        daysRemaining
      };

      if (daysRemaining < 0) {
        categorized.expired.push({ ...entry, status: "EXPIRED", badgeColor: "red" });
      } else if (daysRemaining <= 3) {
        categorized.critical.push({ ...entry, status: "CRITICAL", badgeColor: "orange" });
      } else if (daysRemaining <= 7) {
        categorized.warning.push({ ...entry, status: "WARNING", badgeColor: "yellow" });
      } else {
        categorized.fresh.push({ ...entry, status: "FRESH", badgeColor: "green" });
      }
    });

    return {
      totalItems: batches.length,
      expiredCount: categorized.expired.length,
      criticalCount: categorized.critical.length,
      warningCount: categorized.warning.length,
      freshCount: categorized.fresh.length,
      requiresImmediateAction: categorized.expired.length > 0 || categorized.critical.length > 0,
      details: categorized
    };
  }
}

module.exports = ExpiryAlertService;

// CampusDine Service: Kitchen SLA & Preparation Metrics
const KDSService = {
  // Calculate elapsed preparation minutes for an order
  calculateElapsedMinutes(createdAt) {
    if (!createdAt) return 0;
    const orderTime = new Date(createdAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - orderTime) / 60000));
  },

  // Determine urgency badge color based on kitchen SLA (target: 15 min)
  getUrgencyLevel(elapsedMinutes) {
    if (elapsedMinutes >= 20) return { level: "critical", color: "rose", text: "DELAYED" };
    if (elapsedMinutes >= 12) return { level: "warning", color: "amber", text: "URGENT" };
    return { level: "normal", color: "emerald", text: "ON TIME" };
  },

  // Group kitchen orders by category for station preparation
  groupItemsByStation(items = []) {
    const stations = { grill: [], fryer: [], beverages: [], general: [] };
    items.forEach((it) => {
      const name = (it.name || "").toLowerCase();
      if (name.includes("chai") || name.includes("coffee") || name.includes("juice")) {
        stations.beverages.push(it);
      } else if (name.includes("toast") || name.includes("burger") || name.includes("paratha")) {
        stations.grill.push(it);
      } else if (name.includes("fries") || name.includes("singara") || name.includes("samosa")) {
        stations.fryer.push(it);
      } else {
        stations.general.push(it);
      }
    });
    return stations;
  }
};

module.exports = KDSService;

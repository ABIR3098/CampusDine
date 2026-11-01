// CampusDine UI: ExpiryAlertBanner
// Alerts kitchen admins about ingredients nearing shelf-life expiration
(function() {
  const { React } = window;
  if (!React) return;
  const { useState, useEffect } = React;

  function ExpiryAlertBanner({ onOpenInventory }) {
    const [alertData, setAlertData] = useState({
      criticalCount: 2,
      warningCount: 3,
      items: [
        { name: "Chicken Breast", days: 1, batch: "B-202" },
        { name: "Full Cream Milk", days: 2, batch: "B-189" }
      ]
    });
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || (alertData.criticalCount === 0 && alertData.warningCount === 0)) {
      return null;
    }

    return (
      <div style={{
        backgroundColor: "#FEF2F2",
        border: "1px solid #FCA5A5",
        borderRadius: "10px",
        padding: "12px 16px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 4px rgba(239, 68, 68, 0.08)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <div style={{ fontWeight: "700", color: "#991B1B", fontSize: "14px" }}>
              Perishable Ingredient Expiry Alert
            </div>
            <div style={{ fontSize: "12px", color: "#B91C1C" }}>
              <strong>{alertData.criticalCount} items</strong> expiring within 48h ({alertData.items.map(i => `${i.name} [${i.days}d]`).join(", ")})
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={onOpenInventory}
            style={{
              padding: "6px 12px",
              backgroundColor: "#DC2626",
              color: "#FFF",
              border: "none",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Review Stock
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: "none",
              border: "none",
              color: "#991B1B",
              fontSize: "16px",
              cursor: "pointer"
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.ExpiryAlertBanner = ExpiryAlertBanner;
})();

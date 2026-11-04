// CampusDine UI: EmergencyBannerAlert
// Campus-wide emergency banner notifying students of cafeteria operational status changes
(function() {
  const { React } = window;
  if (!React) return;
  const { useState, useEffect } = React;

  function EmergencyBannerAlert() {
    const [emergency, setEmergency] = useState({
      isActive: true,
      mode: "LIMITED_MENU",
      severity: "WARNING",
      headline: "⚠️ Campus Weather Alert: Limited Cafeteria Service",
      instructions: "Heavy rainfall in Mirpur campus area. Delivery bikes paused. Indoor counters open till 8 PM."
    });
    const [isDismissed, setIsDismissed] = useState(false);

    if (!emergency.isActive || isDismissed) return null;

    const isDanger = emergency.severity === "DANGER" || emergency.mode === "STRIKE_LOCKDOWN";

    return (
      <div style={{
        backgroundColor: isDanger ? "#991B1B" : "#D97706",
        color: "#FFF",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "13px",
        fontWeight: "500",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        zIndex: 9998
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>📢</span>
          <div>
            <strong>{emergency.headline}: </strong>
            <span>{emergency.instructions}</span>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          style={{
            background: "none",
            border: "none",
            color: "#FFF",
            fontSize: "16px",
            cursor: "pointer",
            opacity: 0.85
          }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.EmergencyBannerAlert = EmergencyBannerAlert;
})();

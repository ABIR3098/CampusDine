// CampusDine UI: AdminEmergencyControls
// Kitchen administration controls to toggle cafeteria emergency modes and broadcast campus alerts
(function() {
  const { React } = window;
  if (!React) return;
  const { useState } = React;

  function AdminEmergencyControls() {
    const [currentMode, setCurrentMode] = useState("NORMAL");
    const [headline, setHeadline] = useState("");
    const [instructions, setInstructions] = useState("");

    const handleApplyMode = (mode) => {
      setCurrentMode(mode);
      alert(`🚨 Campus emergency status changed to: ${mode}! Broadcast alert sent to all student screens.`);
    };

    return (
      <div style={{ backgroundColor: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "20px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", color: "#111827", fontWeight: "700" }}>
          🚨 Emergency Operations & Campus Broadcast Control
        </h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>
          Instantly notify students and pause/restrict cafeteria ordering during bad weather, strikes, or supply shortages.
        </p>

        {/* Current Status Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", padding: "10px 14px", backgroundColor: "#F9FAFB", borderRadius: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Current Status:</span>
          <span style={{
            backgroundColor: currentMode === "NORMAL" ? "#DCFCE7" : "#FEE2E2",
            color: currentMode === "NORMAL" ? "#16A34A" : "#DC2626",
            padding: "4px 10px",
            borderRadius: "14px",
            fontSize: "12px",
            fontWeight: "700"
          }}>
            {currentMode}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <button
            onClick={() => handleApplyMode("NORMAL")}
            style={{
              padding: "10px 14px",
              backgroundColor: currentMode === "NORMAL" ? "#16A34A" : "#F3F4F6",
              color: currentMode === "NORMAL" ? "#FFF" : "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            🟢 Normal Operations
          </button>

          <button
            onClick={() => handleApplyMode("LIMITED_MENU")}
            style={{
              padding: "10px 14px",
              backgroundColor: currentMode === "LIMITED_MENU" ? "#D97706" : "#F3F4F6",
              color: currentMode === "LIMITED_MENU" ? "#FFF" : "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            🟡 Limited Emergency Menu
          </button>

          <button
            onClick={() => handleApplyMode("SEVERE_WEATHER")}
            style={{
              padding: "10px 14px",
              backgroundColor: currentMode === "SEVERE_WEATHER" ? "#2563EB" : "#F3F4F6",
              color: currentMode === "SEVERE_WEATHER" ? "#FFF" : "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            🌧️ Weather Alert (Pause Delivery)
          </button>

          <button
            onClick={() => handleApplyMode("STRIKE_LOCKDOWN")}
            style={{
              padding: "10px 14px",
              backgroundColor: currentMode === "STRIKE_LOCKDOWN" ? "#DC2626" : "#F3F4F6",
              color: currentMode === "STRIKE_LOCKDOWN" ? "#FFF" : "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            🔴 Full Lockdown Mode
          </button>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.AdminEmergencyControls = AdminEmergencyControls;
})();

// CampusDine UI: CanteenFloorMap
// Interactive visual seating floor plan showing real-time table statuses
(function() {
  const { React } = window;
  if (!React) return;
  const { useState } = React;

  function CanteenFloorMap({ onSelectTable }) {
    const [selectedTable, setSelectedTable] = useState(null);

    const tables = [
      { id: 1, no: "T-01", zone: "Main Hall", seats: 4, status: "AVAILABLE", x: 40, y: 50 },
      { id: 2, no: "T-02", zone: "Main Hall", seats: 4, status: "OCCUPIED", x: 130, y: 50 },
      { id: 3, no: "T-03", zone: "Main Hall", seats: 6, status: "AVAILABLE", x: 220, y: 50 },
      { id: 4, no: "T-04", zone: "AC Lounge", seats: 8, status: "RESERVED", x: 320, y: 50 },
      { id: 5, no: "T-05", zone: "AC Lounge", seats: 2, status: "AVAILABLE", x: 40, y: 150 },
      { id: 6, no: "T-06", zone: "Open Balcony", seats: 4, status: "AVAILABLE", x: 130, y: 150 },
      { id: 7, no: "T-07", zone: "Open Balcony", seats: 4, status: "OCCUPIED", x: 220, y: 150 },
      { id: 8, no: "T-08", zone: "Faculty Corner", seats: 6, status: "RESERVED", x: 320, y: 150 }
    ];

    const getColor = (status) => {
      switch (status) {
        case "AVAILABLE": return "#10B981"; // Green
        case "OCCUPIED": return "#EF4444";  // Red
        case "RESERVED": return "#F59E0B";  // Yellow/Orange
        default: return "#9CA3AF";
      }
    };

    const handleTableClick = (t) => {
      setSelectedTable(t);
      if (onSelectTable) onSelectTable(t);
    };

    return (
      <div style={{ backgroundColor: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "16px", color: "#111827", fontWeight: "700" }}>🪑 Cafeteria Live Seating Layout</h4>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Click on an available table to book or scan dine-in QR</span>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: "12px", fontSize: "12px", fontWeight: "500" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#10B981" }} /> Free
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#EF4444" }} /> Busy
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#F59E0B" }} /> Reserved
            </span>
          </div>
        </div>

        {/* Floor Map SVG */}
        <div style={{ backgroundColor: "#F9FAFB", borderRadius: "8px", border: "1px dashed #D1D5DB", padding: "12px", display: "flex", justifyContent: "center" }}>
          <svg viewBox="0 0 420 230" style={{ width: "100%", maxWidth: "500px", height: "auto" }}>
            {/* Zones Outline */}
            <rect x="20" y="20" width="280" height="90" rx="8" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1" />
            <text x="30" y="38" fontSize="11" fill="#166534" fontWeight="600">MAIN DINING HALL</text>

            <rect x="310" y="20" width="90" height="90" rx="8" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1" />
            <text x="318" y="38" fontSize="10" fill="#1E40AF" fontWeight="600">AC LOUNGE</text>

            <rect x="20" y="120" width="280" height="90" rx="8" fill="#FEFCE8" stroke="#FEF08A" strokeWidth="1" />
            <text x="30" y="138" fontSize="11" fill="#854D0E" fontWeight="600">OPEN BALCONY</text>

            <rect x="310" y="120" width="90" height="90" rx="8" fill="#FAF5FF" stroke="#E9D5FF" strokeWidth="1" />
            <text x="318" y="138" fontSize="10" fill="#6B21A8" fontWeight="600">FACULTY</text>

            {/* Tables */}
            {tables.map(t => {
              const isSelected = selectedTable && selectedTable.id === t.id;
              return (
                <g key={t.id} onClick={() => handleTableClick(t)} style={{ cursor: "pointer" }}>
                  <rect
                    x={t.x}
                    y={t.y}
                    width="60"
                    height="45"
                    rx="6"
                    fill={getColor(t.status)}
                    stroke={isSelected ? "#1D4ED8" : "#FFF"}
                    strokeWidth={isSelected ? 3 : 1}
                    opacity={isSelected ? 1 : 0.9}
                  />
                  <text x={t.x + 30} y={t.y + 22} textAnchor="middle" fill="#FFF" fontSize="12" fontWeight="700">
                    {t.no}
                  </text>
                  <text x={t.x + 30} y={t.y + 36} textAnchor="middle" fill="#FFF" fontSize="9">
                    {t.seats} seats
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {selectedTable && (
          <div style={{ marginTop: "12px", padding: "10px 14px", backgroundColor: "#EFF6FF", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>Table #{selectedTable.no}</strong> ({selectedTable.zone}) — {selectedTable.seats} Seats — Status: <strong>{selectedTable.status}</strong>
            </div>
            {selectedTable.status === "AVAILABLE" && (
              <span style={{ color: "#2563EB", fontWeight: "600", fontSize: "13px" }}>Ready to Book ✓</span>
            )}
          </div>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.CanteenFloorMap = CanteenFloorMap;
})();

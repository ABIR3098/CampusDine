// CampusDine UI: IngredientStockDashboard
// Real-time kitchen ingredient levels, safety thresholds, and auto-depletion monitoring
(function() {
  const { React } = window;
  if (!React) return;
  const { useState } = React;

  function IngredientStockDashboard() {
    const [filter, setFilter] = useState("all");
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);

    const [stockItems, setStockItems] = useState([
      { id: "ING-1", name: "Basmati Rice", category: "Grains", current: 85, max: 150, min: 30, unit: "kg" },
      { id: "ING-2", name: "Broiler Chicken", category: "Meat", current: 18, max: 80, min: 25, unit: "kg" },
      { id: "ING-3", name: "Mustard Oil", category: "Oils", current: 12, max: 40, min: 10, unit: "L" },
      { id: "ING-4", name: "Onions & Garlic", category: "Produce", current: 6, max: 50, min: 15, unit: "kg" },
      { id: "ING-5", name: "Eggs (Grade A)", category: "Dairy/Eggs", current: 45, max: 200, min: 50, unit: "pcs" },
      { id: "ING-6", name: "Potatoes", category: "Produce", current: 70, max: 100, min: 20, unit: "kg" }
    ]);

    const filteredItems = stockItems.filter(item => {
      const isLow = item.current <= item.min;
      const isCritical = item.current <= (item.min * 0.5);
      if (filter === "low") return isLow;
      if (filter === "critical") return isCritical;
      return true;
    });

    const getStatusBadge = (item) => {
      if (item.current <= item.min * 0.5) {
        return <span style={{ backgroundColor: "#FEE2E2", color: "#DC2626", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>CRITICAL</span>;
      }
      if (item.current <= item.min) {
        return <span style={{ backgroundColor: "#FEF3C7", color: "#D97706", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>LOW STOCK</span>;
      }
      return <span style={{ backgroundColor: "#DCFCE7", color: "#16A34A", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>OPTIMAL</span>;
    };

    return (
      <div style={{ backgroundColor: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {/* Top Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#111827", fontWeight: "700" }}>🥗 Kitchen Ingredient Stock & Depletion</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Stock automatically deducts when kitchen orders are confirmed</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setIsPOModalOpen(true)}
              style={{
                backgroundColor: "#2563EB",
                color: "#FFF",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>+</span> Restock Order (PO)
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[
            { id: "all", label: "All Items" },
            { id: "low", label: "Low Stock Alert" },
            { id: "critical", label: "Critical Only" }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                border: filter === p.id ? "1px solid #2563EB" : "1px solid #E5E7EB",
                backgroundColor: filter === p.id ? "#EFF6FF" : "#FFF",
                color: filter === p.id ? "#2563EB" : "#4B5563",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stock Table */}
        <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left", color: "#4B5563" }}>
                <th style={{ padding: "10px 14px" }}>Ingredient</th>
                <th style={{ padding: "10px 14px" }}>Category</th>
                <th style={{ padding: "10px 14px" }}>Remaining Level</th>
                <th style={{ padding: "10px 14px" }}>Threshold</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const percent = Math.min(100, Math.round((item.current / item.max) * 100));
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "600", color: "#1F2937" }}>{item.name}</td>
                    <td style={{ padding: "12px 14px", color: "#6B7280" }}>{item.category}</td>
                    <td style={{ padding: "12px 14px", minWidth: "160px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span><strong>{item.current}</strong> / {item.max} {item.unit}</span>
                        <span>{percent}%</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "#E5E7EB", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{
                          width: `${percent}%`,
                          height: "100%",
                          backgroundColor: percent < 25 ? "#EF4444" : percent < 50 ? "#F59E0B" : "#10B981"
                        }} />
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#6B7280" }}>Min: {item.min} {item.unit}</td>
                    <td style={{ padding: "12px 14px" }}>{getStatusBadge(item)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PO Modal */}
        {window.CDComponents && window.CDComponents.SupplierPurchaseOrderModal && (
          <window.CDComponents.SupplierPurchaseOrderModal
            isOpen={isPOModalOpen}
            onClose={() => setIsPOModalOpen(false)}
          />
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.IngredientStockDashboard = IngredientStockDashboard;
})();

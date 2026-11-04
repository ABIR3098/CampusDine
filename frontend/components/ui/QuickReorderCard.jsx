// CampusDine UI: QuickReorderCard
// Quick 1-tap reorder carousel widget displaying previously ordered favorites
(function() {
  const { React } = window;
  if (!React) return;

  function QuickReorderCard({ recentItems = [], onReorderItem }) {
    if (!Array.isArray(recentItems) || recentItems.length === 0) return null;

    return (
      <div style={{
        backgroundColor: "var(--panel, #FFF)",
        borderRadius: "14px",
        border: "1px solid var(--line, #E5E7EB)",
        padding: "16px",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>⚡</span>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--ink, #111827)" }}>
              Order It Again
            </h4>
          </div>
          <span style={{ fontSize: "11px", color: "var(--ink-soft, #6B7280)", fontWeight: "500" }}>
            Based on your past orders
          </span>
        </div>

        {/* Horizontal scroll container */}
        <div style={{
          display: "flex",
          gap: "12px",
          overflowX: "auto",
          paddingBottom: "4px"
        }}>
          {recentItems.slice(0, 4).map((item, idx) => (
            <div
              key={idx}
              style={{
                flex: "0 0 170px",
                backgroundColor: "var(--panel-soft, #F9FAFB)",
                borderRadius: "10px",
                border: "1px solid var(--line, #E5E7EB)",
                padding: "10px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink, #1F2937)", truncate: "true" }}>
                  {item.name || "Special Dish"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--leaf, #16A34A)", fontWeight: "700", marginTop: "2px" }}>
                  ৳{item.price || 0}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onReorderItem && onReorderItem(item)}
                style={{
                  marginTop: "8px",
                  padding: "5px 10px",
                  backgroundColor: "#FFF",
                  border: "1px solid #16A34A",
                  color: "#16A34A",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.15s ease"
                }}
              >
                <span>+</span> Add Again
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.QuickReorderCard = QuickReorderCard;
})();

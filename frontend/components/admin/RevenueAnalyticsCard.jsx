// CampusDine UI: RevenueAnalyticsCard
// Visual analytics summary card with financial metrics and top selling dishes
(function() {
  const { React } = window;
  if (!React) return;
  const { useState, useEffect } = React;

  function RevenueAnalyticsCard() {
    const [analytics, setAnalytics] = useState({
      totalRevenue: 24850,
      totalOrders: 114,
      averageOrderValue: 218,
      topDishes: [
        { name: "Chicken Biryani", sales: 42, rev: "৳9,240" },
        { name: "Egg Khichuri", sales: 38, rev: "৳4,560" },
        { name: "Singara Combo", sales: 75, rev: "৳2,250" },
        { name: "Beef Tehari", sales: 29, rev: "৳5,220" }
      ]
    });

    return (
      <div style={{ backgroundColor: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "#111827", fontWeight: "700" }}>
          📊 Today's Canteen Sales & Analytics
        </h3>

        {/* 3 Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "12px", color: "#166534", fontWeight: "600" }}>Total Revenue</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#15803D", marginTop: "4px" }}>৳{analytics.totalRevenue.toLocaleString()}</div>
          </div>

          <div style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "12px", color: "#1E40AF", fontWeight: "600" }}>Completed Orders</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#1D4ED8", marginTop: "4px" }}>{analytics.totalOrders}</div>
          </div>

          <div style={{ backgroundColor: "#FAF5FF", border: "1px solid #E9D5FF", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "12px", color: "#6B21A8", fontWeight: "600" }}>Avg Order Value</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#7E22CE", marginTop: "4px" }}>৳{analytics.averageOrderValue}</div>
          </div>
        </div>

        {/* Top Selling Dishes Table */}
        <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#374151" }}>🏆 Top Selling Dishes Today</h4>
        <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left", color: "#4B5563" }}>
                <th style={{ padding: "8px 12px" }}>Rank</th>
                <th style={{ padding: "8px 12px" }}>Dish</th>
                <th style={{ padding: "8px 12px" }}>Orders</th>
                <th style={{ padding: "8px 12px" }}>Gross Revenue</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topDishes.map((dish, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 12px", fontWeight: "700", color: idx === 0 ? "#F59E0B" : "#6B7280" }}>#{idx + 1}</td>
                  <td style={{ padding: "8px 12px", fontWeight: "600", color: "#1F2937" }}>{dish.name}</td>
                  <td style={{ padding: "8px 12px" }}>{dish.sales} portions</td>
                  <td style={{ padding: "8px 12px", fontWeight: "600", color: "#15803D" }}>{dish.rev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.RevenueAnalyticsCard = RevenueAnalyticsCard;
})();

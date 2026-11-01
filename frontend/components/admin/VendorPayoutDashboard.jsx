// CampusDine UI: VendorPayoutDashboard
// Manages campus cafeteria vendors, platform commission deductions, and daily payouts
(function() {
  const { React } = window;
  if (!React) return;
  const { useState } = React;

  function VendorPayoutDashboard() {
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [vendors, setVendors] = useState([
      { id: "canteen-central", name: "Central Canteen", gross: 30500, comm: 1525, tax: 610, net: 28365, status: "CALCULATED" },
      { id: "cafe-71", name: "Cafe 71 Lounge", gross: 9400, comm: 658, tax: 188, net: 8554, status: "DISBURSED" },
      { id: "night-bakery", name: "Campus Night Bakery", gross: 6800, comm: 272, tax: 136, net: 6392, status: "CALCULATED" },
      { id: "juice-bar", name: "Healthy Juice Corner", gross: 3200, comm: 160, tax: 64, net: 2976, status: "CALCULATED" }
    ]);

    const handleDisburse = (vendorId) => {
      setVendors(vendors.map(v => v.id === vendorId ? { ...v, status: "DISBURSED" } : v));
      alert(`✅ Payout successfully disbursed to ${vendorId}!`);
    };

    const totalGross = vendors.reduce((s, v) => s + v.gross, 0);
    const totalComm = vendors.reduce((s, v) => s + v.comm, 0);
    const totalNet = vendors.reduce((s, v) => s + v.net, 0);

    return (
      <div style={{ backgroundColor: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "20px" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "#111827", fontWeight: "700" }}>
          💰 Vendor Settlements & Commission Engine
        </h3>

        {/* 3 Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "12px", color: "#6B7280" }}>Total Campus Sales</div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#111827", marginTop: "4px" }}>৳{totalGross.toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "12px", color: "#1E40AF" }}>Platform Fees (5-7%)</div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#2563EB", marginTop: "4px" }}>৳{totalComm.toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "12px", color: "#166534" }}>Net Vendor Payout</div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#16A34A", marginTop: "4px" }}>৳{totalNet.toLocaleString()}</div>
          </div>
        </div>

        {/* Vendor Table */}
        <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left", color: "#4B5563" }}>
                <th style={{ padding: "10px 14px" }}>Vendor Name</th>
                <th style={{ padding: "10px 14px" }}>Gross Sales</th>
                <th style={{ padding: "10px 14px" }}>Commission</th>
                <th style={{ padding: "10px 14px" }}>Withholding Tax</th>
                <th style={{ padding: "10px 14px" }}>Net Due</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 14px", fontWeight: "600", color: "#111827" }}>{v.name}</td>
                  <td style={{ padding: "12px 14px" }}>৳{v.gross.toLocaleString()}</td>
                  <td style={{ padding: "12px 14px", color: "#2563EB" }}>-৳{v.comm}</td>
                  <td style={{ padding: "12px 14px", color: "#6B7280" }}>-৳{v.tax}</td>
                  <td style={{ padding: "12px 14px", fontWeight: "700", color: "#15803D" }}>৳{v.net.toLocaleString()}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      backgroundColor: v.status === "DISBURSED" ? "#DCFCE7" : "#FEF3C7",
                      color: v.status === "DISBURSED" ? "#16A34A" : "#D97706",
                      padding: "3px 8px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "700"
                    }}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    {v.status === "CALCULATED" ? (
                      <button
                        onClick={() => handleDisburse(v.id)}
                        style={{ padding: "6px 12px", backgroundColor: "#16A34A", color: "#FFF", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                      >
                        Disburse
                      </button>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>Paid ✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.VendorPayoutDashboard = VendorPayoutDashboard;
})();

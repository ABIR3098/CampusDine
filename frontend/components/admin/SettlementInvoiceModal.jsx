// CampusDine UI: SettlementInvoiceModal
// Vendor invoice statement modal with tax breakdown and downloadable summary
(function() {
  const { React } = window;
  if (!React) return;

  function SettlementInvoiceModal({ isOpen, onClose, statement }) {
    if (!isOpen || !statement) return null;

    return (
      <div style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}>
        <div style={{
          backgroundColor: "#FFF",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "520px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", paddingBottom: "12px", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#111827", fontWeight: "700" }}>🧾 Settlement Statement</h3>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Ref: {statement.settlementId || "SETTL-2026-X"}</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6B7280" }}>✕</button>
          </div>

          {/* Details */}
          <div style={{ fontSize: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6B7280" }}>Vendor:</span>
              <strong>{statement.vendorName || "Central Canteen"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6B7280" }}>Settlement Date:</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6B7280" }}>Gross Completed Sales:</span>
              <span>৳{statement.financials ? statement.financials.grossSales : 0}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#2563EB" }}>
              <span>Platform Commission ({statement.commissionRate ? statement.commissionRate * 100 : 5}%):</span>
              <span>-৳{statement.financials ? statement.financials.commissionAmount : 0}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6B7280" }}>
              <span>Tax Withholding (2%):</span>
              <span>-৳{statement.financials ? statement.financials.taxDeducted : 0}</span>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "16px",
              fontWeight: "800",
              borderTop: "2px solid #E5E7EB",
              paddingTop: "12px",
              marginTop: "8px",
              color: "#15803D"
            }}>
              <span>Net Disbursement:</span>
              <span>৳{statement.financials ? statement.financials.netPayout : 0}</span>
            </div>
          </div>

          {/* Action */}
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => { window.print(); }}
              style={{ padding: "8px 16px", backgroundColor: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
            >
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{ padding: "8px 16px", backgroundColor: "#2563EB", color: "#FFF", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.SettlementInvoiceModal = SettlementInvoiceModal;
})();

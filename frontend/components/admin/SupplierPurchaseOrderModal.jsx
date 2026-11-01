// CampusDine UI: SupplierPurchaseOrderModal
// Enables kitchen managers to draft, calculate, and send purchase orders to wholesale food vendors
(function() {
  const { React } = window;
  if (!React) return;
  const { useState } = React;

  function SupplierPurchaseOrderModal({ isOpen, onClose, onOrderCreated }) {
    if (!isOpen) return null;

    const [supplier, setSupplier] = useState("Dhaka Wholesale Poultry & Dairy");
    const [items, setItems] = useState([
      { itemName: "Broiler Chicken (dressed)", quantity: 30, unit: "kg", unitPrice: 210 },
      { itemName: "Basmati Rice (Special)", quantity: 50, unit: "kg", unitPrice: 120 }
    ]);
    const [newItemName, setNewItemName] = useState("");
    const [newQty, setNewQty] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [newUnit, setNewUnit] = useState("kg");

    const addItem = () => {
      if (!newItemName.trim() || !newQty || !newPrice) return;
      setItems([...items, {
        itemName: newItemName.trim(),
        quantity: Number(newQty),
        unit: newUnit,
        unitPrice: Number(newPrice)
      }]);
      setNewItemName("");
      setNewQty("");
      setNewPrice("");
    };

    const removeItem = (idx) => {
      setItems(items.filter((_, i) => i !== idx));
    };

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = Math.round(subtotal * 0.05);
    const grandTotal = subtotal + tax;

    const handleCreatePO = () => {
      if (items.length === 0) return alert("Please add at least one item.");
      const poData = {
        supplierName: supplier,
        items,
        subtotal,
        grandTotal,
        date: new Date().toLocaleDateString()
      };
      if (onOrderCreated) onOrderCreated(poData);
      alert(`Purchase order for ৳${grandTotal} submitted successfully!`);
      onClose();
    };

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
          maxWidth: "600px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
        }}>
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#111827", fontWeight: "700" }}>📦 Create Supplier Purchase Order</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6B7280" }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Vendor / Supplier</label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "14px" }}
              >
                <option value="Dhaka Wholesale Poultry & Dairy">Dhaka Wholesale Poultry & Dairy</option>
                <option value="Mirpur Fresh Grocery Distributors">Mirpur Fresh Grocery Distributors</option>
                <option value="BUP Campus Bakery Supplier">BUP Campus Bakery Supplier</option>
              </select>
            </div>

            {/* Item List */}
            <h4 style={{ margin: "16px 0 8px 0", fontSize: "14px", color: "#374151" }}>Order Items</h4>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Item</th>
                    <th style={{ padding: "8px 12px" }}>Qty</th>
                    <th style={{ padding: "8px 12px" }}>Unit Price</th>
                    <th style={{ padding: "8px 12px" }}>Total</th>
                    <th style={{ padding: "8px 12px", width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "8px 12px", fontWeight: "500" }}>{it.itemName}</td>
                      <td style={{ padding: "8px 12px" }}>{it.quantity} {it.unit}</td>
                      <td style={{ padding: "8px 12px" }}>৳{it.unitPrice}</td>
                      <td style={{ padding: "8px 12px", fontWeight: "600" }}>৳{it.quantity * it.unitPrice}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Item Row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "8px", alignItems: "end", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#6B7280" }}>Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cooking Oil"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#6B7280" }}>Qty</label>
                <input
                  type="number"
                  placeholder="20"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#6B7280" }}>Unit</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "13px" }}
                >
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="crate">crate</option>
                  <option value="pack">pack</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#6B7280" }}>Price (৳)</label>
                <input
                  type="number"
                  placeholder="160"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "13px" }}
                />
              </div>
              <button
                type="button"
                onClick={addItem}
                style={{ padding: "8px 14px", backgroundColor: "#2563EB", color: "#FFF", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
              >
                + Add
              </button>
            </div>

            {/* Total Summary */}
            <div style={{ backgroundColor: "#F9FAFB", padding: "12px", borderRadius: "8px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Subtotal:</span>
                <strong>৳{subtotal}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Tax & VAT (5%):</span>
                <span>৳{tax}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: "700", borderTop: "1px solid #E5E7EB", paddingTop: "6px" }}>
                <span>Grand Total:</span>
                <span style={{ color: "#2563EB" }}>৳{grandTotal}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={onClose} style={{ padding: "8px 16px", backgroundColor: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleCreatePO} style={{ padding: "8px 18px", backgroundColor: "#16A34A", color: "#FFF", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Generate & Send PO</button>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.SupplierPurchaseOrderModal = SupplierPurchaseOrderModal;
})();

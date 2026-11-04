// CampusDine UI: FloatingCartBar
// Sticky bottom checkout preview bar appearing on small/mobile screens when items are in cart
(function() {
  const { React } = window;
  if (!React) return;

  function FloatingCartBar({ cart = [], onOpenCart }) {
    if (!Array.isArray(cart) || cart.length === 0) return null;

    const totalItems = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    const totalPrice = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);

    return (
      <div style={{
        position: "fixed",
        bottom: "64px", // Positioned nicely above bottom navigation bar on mobile
        left: "16px",
        right: "16px",
        maxWidth: "460px",
        margin: "0 auto",
        zIndex: 45,
        animation: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
      }}>
        <div
          onClick={onOpenCart}
          style={{
            backgroundColor: "#16A34A",
            color: "#FFF",
            borderRadius: "14px",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 10px 25px -3px rgba(22, 163, 74, 0.45), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            cursor: "pointer",
            transition: "transform 0.15s ease",
            backdropFilter: "blur(8px)"
          }}
        >
          {/* Left info */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.9, fontWeight: "600" }}>
              {totalItems} {totalItems === 1 ? "Item" : "Items"} in Cart
            </span>
            <span style={{ fontSize: "18px", fontWeight: "800", lineHeight: 1.2 }}>
              ৳{totalPrice.toLocaleString()}
            </span>
          </div>

          {/* Right action */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            padding: "6px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "700"
          }}>
            <span>View Cart</span>
            <span>➔</span>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.FloatingCartBar = FloatingCartBar;
})();

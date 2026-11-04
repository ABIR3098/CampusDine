// CampusDine UI: EmptyState
// Reusable illustrated empty states for cart, orders, search, and notifications
(function() {
  const { React } = window;
  if (!React) return;

  function EmptyState({
    type = "cart",
    title,
    subtitle,
    actionText,
    onAction
  }) {
    const config = {
      cart: {
        icon: "🍽️",
        defaultTitle: "Your cart is currently empty",
        defaultSubtitle: "Explore our freshly cooked canteen specialties and add your favorites!",
        defaultAction: "Browse Menu"
      },
      orders: {
        icon: "📦",
        defaultTitle: "No active orders found",
        defaultSubtitle: "Looks like you haven't placed any meal orders yet today.",
        defaultAction: "Order Food Now"
      },
      search: {
        icon: "🔍",
        defaultTitle: "No delicious matches found",
        defaultSubtitle: "Try checking your spelling or search for popular items like Biryani, Khichuri or Coffee.",
        defaultAction: "Clear Search Filter"
      },
      notifications: {
        icon: "🔔",
        defaultTitle: "All caught up!",
        defaultSubtitle: "No unread alerts or cafeteria notifications at the moment.",
        defaultAction: null
      }
    };

    const current = config[type] || config.cart;
    const resolvedTitle = title || current.defaultTitle;
    const resolvedSubtitle = subtitle || current.defaultSubtitle;
    const resolvedAction = actionText !== undefined ? actionText : current.defaultAction;

    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "36px 20px",
        textAlign: "center",
        backgroundColor: "var(--panel-soft, #F9FAFB)",
        borderRadius: "16px",
        border: "1px dashed var(--line, #E5E7EB)",
        margin: "16px 0"
      }}>
        <div style={{
          fontSize: "44px",
          marginBottom: "12px",
          filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.06))",
          lineHeight: 1
        }}>
          {current.icon}
        </div>

        <h4 style={{
          fontSize: "16px",
          fontWeight: "700",
          color: "var(--ink, #111827)",
          margin: "0 0 6px 0"
        }}>
          {resolvedTitle}
        </h4>

        <p style={{
          fontSize: "13px",
          color: "var(--ink-soft, #6B7280)",
          maxWidth: "360px",
          margin: "0 0 16px 0",
          lineHeight: "1.4"
        }}>
          {resolvedSubtitle}
        </p>

        {resolvedAction && onAction && (
          <button
            type="button"
            onClick={onAction}
            style={{
              padding: "8px 18px",
              backgroundColor: "var(--leaf, #16A34A)",
              color: "#FFF",
              border: "none",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
              transition: "transform 0.15s ease, opacity 0.15s ease"
            }}
          >
            {resolvedAction} ➔
          </button>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.EmptyState = EmptyState;
})();

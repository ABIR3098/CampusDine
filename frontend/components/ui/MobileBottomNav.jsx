// CampusDine UI: MobileBottomNav
// Native app-style bottom navigation bar for mobile touch screens
(function() {
  const { React } = window;
  if (!React) return;

  function MobileBottomNav({ activeTab = "menu", onSelectTab, role = "student", cartCount = 0, unreadNotifs = 0 }) {
    if (role === "admin") return null; // Admins use desktop portal sidebar

    const tabs = [
      { key: "menu", label: "Menu", icon: "🍽️", badge: 0 },
      { key: "track", label: "Orders", icon: "📦", badge: cartCount },
      { key: "wallet", label: "Wallet", icon: "💳", badge: 0 },
      { key: "rewards", label: "Rewards", icon: "🎁", badge: 0 },
      { key: "profile", label: "Profile", icon: "👤", badge: unreadNotifs }
    ];

    return (
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60px",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line, #E5E7EB)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 40,
          boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.05)"
        }}
      >
        {tabs.map(t => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelectTab && onSelectTab(t.key)}
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                padding: "6px 0",
                cursor: "pointer",
                position: "relative",
                color: isActive ? "#16A34A" : "#6B7280",
                transition: "color 0.15s ease"
              }}
            >
              <div style={{ position: "relative", fontSize: "18px", lineHeight: 1 }}>
                <span>{t.icon}</span>
                {t.badge > 0 && (
                  <span style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-8px",
                    backgroundColor: "#EF4444",
                    color: "#FFF",
                    borderRadius: "10px",
                    fontSize: "9px",
                    fontWeight: "800",
                    padding: "1px 5px",
                    lineHeight: "12px",
                    minWidth: "14px",
                    textAlign: "center"
                  }}>
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: isActive ? "700" : "500",
                marginTop: "3px"
              }}>
                {t.label}
              </span>
              {isActive && (
                <div style={{
                  position: "absolute",
                  bottom: "2px",
                  width: "16px",
                  height: "3px",
                  borderRadius: "2px",
                  backgroundColor: "#16A34A"
                }} />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.MobileBottomNav = MobileBottomNav;
})();

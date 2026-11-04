// CampusDine UI: CategoryPillsBar
// Sticky horizontal scrolling category selector with icons and item count badges
(function() {
  const { React } = window;
  if (!React) return;

  function CategoryPillsBar({
    activeCategory = "heavy",
    onSelectCategory,
    categoryCounts = { heavy: 12, snacks: 8, drinks: 6, fav: 4 }
  }) {
    const categories = [
      { id: "heavy", label: "Main Meals", icon: "🍲" },
      { id: "snacks", label: "Snacks & Bakery", icon: "🥪" },
      { id: "drinks", label: "Drinks & Tea", icon: "🥤" },
      { id: "fav", label: "Favorites", icon: "⭐" }
    ];

    return (
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        backgroundColor: "var(--panel, #FFFFFF)",
        padding: "10px 0",
        borderBottom: "1px solid var(--line, #E5E7EB)",
        marginBottom: "16px"
      }}>
        <div style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingBottom: "2px"
        }}>
          {categories.map(c => {
            const isActive = activeCategory === c.id;
            const count = categoryCounts[c.id] || 0;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCategory && onSelectCategory(c.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "24px",
                  fontSize: "13px",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  border: isActive ? "1px solid #16A34A" : "1px solid var(--line, #E5E7EB)",
                  backgroundColor: isActive ? "#F0FDF4" : "var(--panel-soft, #F9FAFB)",
                  color: isActive ? "#15803D" : "var(--ink, #374151)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 2px 4px rgba(22, 163, 74, 0.12)" : "none"
                }}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    backgroundColor: isActive ? "#16A34A" : "var(--line, #E5E7EB)",
                    color: isActive ? "#FFF" : "var(--ink-soft, #6B7280)"
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.CategoryPillsBar = CategoryPillsBar;
})();

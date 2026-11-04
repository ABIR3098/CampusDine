// CampusDine UI: FoodBadge
// Visual dietary, spice, rating and popularity markers for dish cards
(function() {
  const { React } = window;
  if (!React) return;

  function FoodBadge({ type = "veg", level = 1, text = "", rating = 4.8 }) {
    if (type === "veg") {
      return (
        <span
          title="Vegetarian Dish"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "16px",
            height: "16px",
            border: "2px solid #16A34A",
            borderRadius: "3px",
            padding: "1px",
            backgroundColor: "#FFF"
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#16A34A" }} />
        </span>
      );
    }

    if (type === "non-veg") {
      return (
        <span
          title="Non-Vegetarian (Halal Meat/Poultry)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "16px",
            height: "16px",
            border: "2px solid #DC2626",
            borderRadius: "3px",
            padding: "1px",
            backgroundColor: "#FFF"
          }}
        >
          <span style={{
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderBottom: "7px solid #DC2626"
          }} />
        </span>
      );
    }

    if (type === "spicy") {
      const chilis = "🌶️".repeat(Math.min(3, Math.max(1, Number(level) || 1)));
      return (
        <span
          title={`Spice Level: ${level}/3`}
          style={{
            fontSize: "11px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "12px",
            padding: "2px 6px",
            color: "#991B1B",
            fontWeight: "600",
            display: "inline-flex",
            alignItems: "center",
            gap: "2px"
          }}
        >
          {chilis}
        </span>
      );
    }

    if (type === "bestseller") {
      return (
        <span
          style={{
            fontSize: "11px",
            backgroundColor: "#FEF3C7",
            border: "1px solid #FCD34D",
            color: "#92400E",
            fontWeight: "700",
            borderRadius: "12px",
            padding: "2px 8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "3px"
          }}
        >
          🔥 {text || "Bestseller"}
        </span>
      );
    }

    if (type === "rating") {
      return (
        <span
          style={{
            fontSize: "11px",
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            color: "#166534",
            fontWeight: "700",
            borderRadius: "12px",
            padding: "2px 6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "2px"
          }}
        >
          ★ {rating}
        </span>
      );
    }

    return null;
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.FoodBadge = FoodBadge;
})();

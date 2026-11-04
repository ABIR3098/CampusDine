// CampusDine Service: Recipe Ingredients Mapping & Automated Stock Depletion
const DEFAULT_RECIPES = {
  "chicken biryani": [
    { ingredient: "Basmati Rice", qtyKg: 0.20 },
    { ingredient: "Broiler Chicken", qtyKg: 0.18 },
    { ingredient: "Soybean Oil", qtyKg: 0.03 },
    { ingredient: "Biryani Spices", qtyKg: 0.015 }
  ],
  "egg khichuri": [
    { ingredient: "Polao Rice", qtyKg: 0.15 },
    { ingredient: "Moong Dal", qtyKg: 0.05 },
    { ingredient: "Farm Egg", qtyKg: 1 }, // unit: pieces
    { ingredient: "Mustard Oil", qtyKg: 0.02 }
  ],
  "beef burger": [
    { ingredient: "Burger Bun", qtyKg: 1 },
    { ingredient: "Beef Patty", qtyKg: 0.12 },
    { ingredient: "Cheddar Cheese", qtyKg: 0.02 },
    { ingredient: "Sauce & Mayo", qtyKg: 0.025 }
  ]
};

const RecipeDepletionService = {
  DEFAULT_RECIPES,

  // Map order items to required raw ingredient quantities
  calculateDepletion(orderItems = []) {
    const ingredientRequirements = {};

    orderItems.forEach((item) => {
      const name = (item.name || "").toLowerCase().trim();
      const orderQty = Math.max(1, Number(item.qty || 1));

      // Find matching recipe
      const matchingKey = Object.keys(DEFAULT_RECIPES).find((k) => name.includes(k));
      const recipe = matchingKey ? DEFAULT_RECIPES[matchingKey] : null;

      if (recipe) {
        recipe.forEach((ing) => {
          const needed = ing.qtyKg * orderQty;
          ingredientRequirements[ing.ingredient] = (ingredientRequirements[ing.ingredient] || 0) + needed;
        });
      }
    });

    return Object.keys(ingredientRequirements).map((ing) => ({
      ingredient: ing,
      totalQuantityNeeded: Number(ingredientRequirements[ing].toFixed(3))
    }));
  },

  // Check if stock has reached critical reorder threshold (below 10 units)
  isLowStock(currentStock, reorderLevel = 10) {
    return Number(currentStock || 0) <= Number(reorderLevel);
  }
};

module.exports = RecipeDepletionService;

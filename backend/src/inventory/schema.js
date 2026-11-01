// Creates the Staff role and the inventory tables if they are missing. Existing data is never touched.

const DEFAULT_ITEMS = [
  { name: "Rice", nameBn: "চাল", category: "Grains", unit: "kg", stock: 120, min: 40 },
  { name: "Lentils (Dal)", nameBn: "ডাল", category: "Grains", unit: "kg", stock: 45, min: 15 },
  { name: "Potato", nameBn: "আলু", category: "Vegetables", unit: "kg", stock: 60, min: 20 },
  { name: "Onion", nameBn: "পেঁয়াজ", category: "Vegetables", unit: "kg", stock: 35, min: 15 },

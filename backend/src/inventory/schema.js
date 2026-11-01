// Creates the Staff role and the inventory tables if they are missing. Existing data is never touched.

const DEFAULT_ITEMS = [
  { name: "Rice", nameBn: "চাল", category: "Grains", unit: "kg", stock: 120, min: 40 },
  { name: "Lentils (Dal)", nameBn: "ডাল", category: "Grains", unit: "kg", stock: 45, min: 15 },
  { name: "Potato", nameBn: "আলু", category: "Vegetables", unit: "kg", stock: 60, min: 20 },
  { name: "Onion", nameBn: "পেঁয়াজ", category: "Vegetables", unit: "kg", stock: 35, min: 15 },
  { name: "Cooking Oil", nameBn: "তেল", category: "Oil & Spices", unit: "litre", stock: 30, min: 10 },
  { name: "Salt", nameBn: "লবণ", category: "Oil & Spices", unit: "kg", stock: 12, min: 4 },
  { name: "Sugar", nameBn: "চিনি", category: "Oil & Spices", unit: "kg", stock: 18, min: 6 },
  { name: "Flour (Atta)", nameBn: "আটা", category: "Grains", unit: "kg", stock: 40, min: 12 },
  { name: "Eggs", nameBn: "ডিম", category: "Protein", unit: "dozen", stock: 25, min: 8 },
  { name: "Chicken", nameBn: "মুরগি", category: "Protein", unit: "kg", stock: 28, min: 10 },
];

const ROLE_ENUM = "ENUM('student','teacher','admin','rider','hall_admin','staff')";

async function ensureInventorySchema(db) {
  await db.query(`ALTER TABLE users MODIFY COLUMN role ${ROLE_ENUM} NOT NULL`);


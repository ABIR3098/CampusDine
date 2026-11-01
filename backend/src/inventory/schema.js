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

  await db.query(`CREATE TABLE IF NOT EXISTS inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    name_bn VARCHAR(80) NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'General',
    unit VARCHAR(12) NOT NULL,
    current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
    min_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inventory_item_name (name)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS inventory_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    item_id INT NOT NULL,
    request_type ENUM('report','request') NOT NULL DEFAULT 'request',
    current_qty DECIMAL(12,2) NOT NULL,
    required_qty DECIMAL(12,2) NOT NULL,
    note VARCHAR(500) NULL,
    status ENUM('pending','approved','rejected','purchased') NOT NULL DEFAULT 'pending',

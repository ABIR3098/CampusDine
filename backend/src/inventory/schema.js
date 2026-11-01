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
    admin_id INT NULL,
    admin_reply VARCHAR(500) NULL,
    decided_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_inv_req_staff (staff_id, created_at),
    KEY idx_inv_req_status (status, created_at),
    CONSTRAINT fk_inv_req_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_req_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS inventory_purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NULL,
    item_id INT NOT NULL,
    admin_id INT NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    unit_cost DECIMAL(12,2) NULL,
    total_cost DECIMAL(14,2) NULL,
    supplier VARCHAR(120) NULL,
    note VARCHAR(500) NULL,
    purchased_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_inv_purchase_item (item_id, purchased_at),
    CONSTRAINT fk_inv_purchase_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS inventory_stock_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    change_qty DECIMAL(12,2) NOT NULL,
    stock_before DECIMAL(12,2) NOT NULL,
    stock_after DECIMAL(12,2) NOT NULL,
    reason ENUM('opening','purchase','adjustment') NOT NULL,
    purchase_id INT NULL,
    actor_id INT NULL,
    note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_inv_hist_item (item_id, created_at),
    CONSTRAINT fk_inv_hist_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
  )`);

  await db.query(`ALTER TABLE inventory_stock_history MODIFY COLUMN reason ENUM('opening','purchase','adjustment','usage') NOT NULL`);
  await db.query(`CREATE TABLE IF NOT EXISTS inventory_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    staff_id INT NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    usage_date DATE NOT NULL,
  // Seed the starting raw materials once (only when the table is empty).
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM inventory_items");
  if (Number(n) === 0) {
    for (const it of DEFAULT_ITEMS) {
      const [r] = await db.query(
        "INSERT INTO inventory_items (name, name_bn, category, unit, current_stock, min_stock) VALUES (?, ?, ?, ?, ?, ?)",
        [it.name, it.nameBn, it.category, it.unit, it.stock, it.min]
      );
      await db.query(
        "INSERT INTO inventory_stock_history (item_id, change_qty, stock_before, stock_after, reason, note) VALUES (?, ?, 0, ?, 'opening', 'Opening stock')",
        [r.insertId, it.stock, it.stock]
      );
    }
  }
}

module.exports = { ensureInventorySchema, DEFAULT_ITEMS, ROLE_ENUM };

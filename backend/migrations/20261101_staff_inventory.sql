-- CampusDine: Staff role + kitchen inventory.
-- Safe to run more than once. The server also applies the same changes at start-up (src/inventory/schema.js).

ALTER TABLE users MODIFY COLUMN role ENUM('student','teacher','admin','rider','hall_admin','staff') NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_items (
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
);

CREATE TABLE IF NOT EXISTS inventory_requests (
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
);

CREATE TABLE IF NOT EXISTS inventory_purchases (
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
);

CREATE TABLE IF NOT EXISTS inventory_stock_history (
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
);

-- Daily material usage (staff record what they used; the system deducts it from official stock).
ALTER TABLE inventory_stock_history MODIFY COLUMN reason ENUM('opening','purchase','adjustment','usage') NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  staff_id INT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  usage_date DATE NOT NULL,
  note VARCHAR(500) NULL,
  stock_before DECIMAL(12,2) NOT NULL,
  stock_after DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inv_usage_date (usage_date, item_id),
  KEY idx_inv_usage_staff (staff_id, created_at),
  CONSTRAINT fk_inv_usage_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_usage_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

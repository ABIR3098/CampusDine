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

SET NAMES utf8mb4;

-- CampusDine database schema
-- Run:  mysql -u root -p campusdine < schema.sql
-- (create the database first: CREATE DATABASE campusdine;)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NULL UNIQUE,
  external_id VARCHAR(50) NOT NULL UNIQUE,
  role ENUM('student','teacher','admin','rider') NOT NULL,
  account_type ENUM('regular','hall') NOT NULL DEFAULT 'regular',
  password_hash VARCHAR(255) NOT NULL,
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  phone VARCHAR(20) NULL,
  address VARCHAR(255) NULL,
  department VARCHAR(100) NULL,
  father_phone VARCHAR(20) NULL,
  hall_name VARCHAR(60) NULL,
  room_number VARCHAR(20) NULL,
  hall_id VARCHAR(20) NULL UNIQUE,
  avatar MEDIUMTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature: extended profile
-- For an existing 'campusdine' DB, run once if needed:
-- ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER wallet_balance;
-- ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER phone;
-- ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL AFTER address;
-- ALTER TABLE users ADD COLUMN father_phone VARCHAR(20) NULL AFTER department;
-- ALTER TABLE users ADD COLUMN room_number VARCHAR(20) NULL AFTER father_phone;
-- ALTER TABLE users ADD COLUMN hall_id VARCHAR(20) NULL UNIQUE AFTER room_number;

-- Feature: email + hall-resident accounts + QR pickup
-- The server adds these automatically on start.
-- To do it manually on an existing DB:
-- ALTER TABLE users ADD COLUMN email VARCHAR(120) NULL;
-- ALTER TABLE users ADD UNIQUE KEY uniq_users_email (email);
-- ALTER TABLE users ADD COLUMN account_type ENUM('regular','hall') NOT NULL DEFAULT 'regular';
-- ALTER TABLE users ADD COLUMN hall_name VARCHAR(60) NULL;
-- ALTER TABLE orders ADD COLUMN picked_up_at DATETIME NULL;
-- UPDATE users SET account_type = 'hall' WHERE hall_id IS NOT NULL;

-- Feature: meal plan
-- ALTER TABLE meal_calendar ADD COLUMN paid_amount DECIMAL(10,2) NULL;
-- ALTER TABLE meal_calendar ADD COLUMN paid_at DATETIME NULL;

-- Feature: veg / non-veg marking
-- ALTER TABLE menu_items ADD COLUMN is_veg TINYINT(1) NOT NULL DEFAULT 1 AFTER tag;
-- UPDATE menu_items SET is_veg = 0 WHERE name IN ('Tehari', 'Chicken Roll');

CREATE TABLE IF NOT EXISTS meal_rates (
  role ENUM('student','teacher') PRIMARY KEY,
  full_rate DECIMAL(10,2) NOT NULL,
  half_rate DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100),
  category ENUM('heavy','snacks','drinks') NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  tag VARCHAR(30),
  is_veg TINYINT(1) NOT NULL DEFAULT 1,
  availability VARCHAR(12) NOT NULL DEFAULT 'available',
  image VARCHAR(200) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature: favorites / wishlist
CREATE TABLE IF NOT EXISTS favourites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_item (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES menu_items(id)
);

-- Feature: stock alerts
CREATE TABLE IF NOT EXISTS stock_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stock_alert_user_item (user_id, menu_item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_applied TINYINT(1) NOT NULL DEFAULT 0,
  payment_method ENUM('wallet','cash') NOT NULL,
  pickup_time DATETIME NULL,
  note VARCHAR(255) NULL,
  delivery_note VARCHAR(255) NULL,
  status ENUM('Received','Cooking','Ready','Cancelled') NOT NULL DEFAULT 'Received',
  rider_id INT NULL,
  rider_assignment_status ENUM('Unassigned','Assigned','Accepted','Declined','Completed') NOT NULL DEFAULT 'Unassigned',
  delivery_lat DECIMAL(10,7) NULL,
  delivery_lng DECIMAL(10,7) NULL,
  picked_up_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_orders_rider_status (rider_id, rider_assignment_status),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rider_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rider_id INT NOT NULL,
  status ENUM('ON_DUTY','OFF_DUTY') NOT NULL DEFAULT 'OFF_DUTY',
  max_orders INT NOT NULL DEFAULT 3,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  active_key TINYINT GENERATED ALWAYS AS (
    CASE WHEN status = 'ON_DUTY' THEN 1 ELSE NULL END
  ) STORED,
  UNIQUE KEY uq_rider_one_active_shift (rider_id, active_key),
  KEY idx_rider_shift_status (rider_id, status),
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fraud_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  event_type VARCHAR(80) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
  details_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fraud_created (created_at),
  KEY idx_fraud_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(80) NULL,
  details_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS group_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_user_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  join_code VARCHAR(12) NOT NULL UNIQUE,
  closes_at DATETIME NOT NULL,
  status ENUM('OPEN','CLOSED','CHECKED_OUT') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_order_members (
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES group_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_member_item (group_id, user_id, menu_item_id),
  FOREIGN KEY (group_id) REFERENCES group_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS direct_order_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  message VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  KEY idx_direct_chat_order (order_id, id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Feature: order cancel + refund
-- ALTER TABLE orders MODIFY status ENUM('Received','Cooking','Ready','Cancelled') NOT NULL DEFAULT 'Received';

-- Feature: pre-order / scheduled pickup
-- ALTER TABLE orders ADD COLUMN pickup_time DATETIME NULL AFTER payment_method;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  qty INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(150) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS meal_calendar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  the_date DATE NOT NULL,
  status ENUM('off','full','half') NOT NULL DEFAULT 'off',
  paid_amount DECIMAL(10,2) NULL,
  paid_at DATETIME NULL,
  UNIQUE KEY uniq_user_date (user_id, the_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL UNIQUE,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS general_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category ENUM('food','service','hygiene','suggestion','other') NOT NULL DEFAULT 'other',
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type ENUM('PERCENTAGE','FIXED') NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount DECIMAL(10,2) NULL,
  usage_limit INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  expiry_date DATETIME NULL,
  description VARCHAR(255) NULL,
  applies_to_all_items TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL,
  item_id INT NOT NULL,
  UNIQUE KEY uniq_coupon_item (coupon_id, item_id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  coupon_id INT NOT NULL,
  order_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_coupon_order (user_id, coupon_id, order_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ---------- Seed data ----------

INSERT INTO meal_rates (role, full_rate, half_rate) VALUES
  ('student', 90, 50),
  ('teacher', 130, 70)
ON DUPLICATE KEY UPDATE
  full_rate = VALUES(full_rate),
  half_rate = VALUES(half_rate);

INSERT INTO menu_items (name, name_bn, category, price, stock, tag, is_veg)
SELECT * FROM (
  SELECT 'Khichuri' AS name, 'খিচুড়ি' AS name_bn, 'heavy' AS category, 60 AS price, 40 AS stock, 'Popular' AS tag, 1 AS is_veg
  UNION ALL SELECT 'Tehari', 'তেহারি', 'heavy', 80, 25, 'Popular', 0
  UNION ALL SELECT 'Porota-Vaji', 'পরোটা-ভাজি', 'heavy', 40, 6, NULL, 1
  UNION ALL SELECT 'Plain Rice & Dal', 'ভাত-ডাল', 'heavy', 45, 30, NULL, 1
  UNION ALL SELECT 'Singara', 'সিঙ্গারা', 'snacks', 10, 60, 'New', 1
  UNION ALL SELECT 'Fuchka', 'ফুচকা', 'snacks', 30, 4, 'Popular', 1
  UNION ALL SELECT 'Chicken Roll', 'চিকেন রোল', 'snacks', 50, 20, NULL, 0
  UNION ALL SELECT 'Cha (Tea)', 'চা', 'drinks', 8, 120, NULL, 1
  UNION ALL SELECT 'Lassi', 'লাচ্ছি', 'drinks', 35, 15, 'New', 1
  UNION ALL SELECT 'Mineral Water', 'পানি', 'drinks', 15, 50, NULL, 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM menu_items);

-- No demo user accounts are seeded here on purpose.
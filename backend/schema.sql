-- CampusDine database schema
-- Run:  mysql -u root -p campusdine < schema.sql
-- (create the database first: CREATE DATABASE campusdine;)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  external_id VARCHAR(50) NOT NULL UNIQUE,   -- student/teacher/admin ID used to log in
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(30),
  role ENUM('student','teacher','admin') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  reset_otp_hash CHAR(64),
  reset_otp_expiry DATETIME,
  notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
  description VARCHAR(255),
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token CHAR(36) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2),
  order_token CHAR(36),
  meal_date DATE NOT NULL,
  idempotency_key VARCHAR(100),
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_applied BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method ENUM('wallet','cash','bkash','nagad') NOT NULL,
  status ENUM('Received','Cooking','Ready','Confirmed','Cancelled','Refunded') NOT NULL DEFAULT 'Received',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_order_idempotency (user_id, idempotency_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT,
  name VARCHAR(100) NOT NULL,   -- snapshot at order time
  price DECIMAL(10,2) NOT NULL, -- snapshot at order time
  qty INT NOT NULL,
  quantity INT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(150) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,  -- positive = credit, negative = debit
  hidden_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS meal_calendar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  the_date DATE NOT NULL,
  status ENUM('off','full','half') NOT NULL DEFAULT 'off',
  UNIQUE KEY uniq_user_date (user_id, the_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_favorite (user_id, menu_item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  rating TINYINT NOT NULL,
  review VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rating (user_id, menu_item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  discount_type ENUM('PERCENTAGE','FIXED') NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount DECIMAL(10,2),
  usage_limit INT,
  used_count INT NOT NULL DEFAULT 0,
  expiry_date DATETIME,
  description VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  coupon_id INT NOT NULL,
  order_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_coupon_order (coupon_id, order_id),
  UNIQUE KEY uniq_coupon_user (coupon_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT,
  payment_method VARCHAR(30) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'PENDING',
  transaction_ref VARCHAR(100) UNIQUE,
  bkash_trx_id VARCHAR(100),
  nagad_trx_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ---------- Seed data ----------

INSERT INTO meal_rates (role, full_rate, half_rate) VALUES
  ('student', 90, 50),
  ('teacher', 130, 70)
ON DUPLICATE KEY UPDATE full_rate = VALUES(full_rate), half_rate = VALUES(half_rate);

INSERT INTO menu_items (name, name_bn, category, price, stock, tag) VALUES
  ('Khichuri', 'খিচুড়ি', 'heavy', 60, 40, 'Popular'),
  ('Tehari', 'তেহারি', 'heavy', 80, 25, 'Popular'),
  ('Porota-Vaji', 'পরোটা-ভাজি', 'heavy', 40, 6, NULL),
  ('Plain Rice & Dal', 'ভাত-ডাল', 'heavy', 45, 30, NULL),
  ('Singara', 'সিঙ্গারা', 'snacks', 10, 60, 'New'),
  ('Fuchka', 'ফুচকা', 'snacks', 30, 4, 'Popular'),
  ('Chicken Roll', 'চিকেন রোল', 'snacks', 50, 20, NULL),
  ('Cha (Tea)', 'চা', 'drinks', 8, 120, NULL),
  ('Lassi', 'লাচ্ছি', 'drinks', 35, 15, 'New'),
  ('Mineral Water', 'পানি', 'drinks', 15, 50, NULL);

INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, expiry_date, description, is_active)
VALUES ('CAMPUS10', 'PERCENTAGE', 10, 50, 100, 1000, DATE_ADD(NOW(), INTERVAL 1 YEAR), '10% off for campus orders', 1)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), expiry_date = VALUES(expiry_date);

-- No demo user accounts are seeded here on purpose: password_hash must be a real
-- bcrypt hash, and one can't be safely hand-written in a SQL file. Instead, create
-- your student/teacher/admin accounts through the running API — see Step 6 in the
-- README ("Register your first users") — which hashes the password correctly.

CREATE TABLE IF NOT EXISTS notification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT NULL,
  notification_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

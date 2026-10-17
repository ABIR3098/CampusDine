SET NAMES utf8mb4;  -- Bangla names + emoji need utf8mb4 (create the database with CHARACTER SET utf8mb4)
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
  reset_otp_attempts INT NOT NULL DEFAULT 0,
  notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_budget DECIMAL(10,2) NULL,          -- optional spending limit per week
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
<<<<<<< Updated upstream
  description VARCHAR(255),
  image_url VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = archived (hidden from students)
  is_veg BOOLEAN NOT NULL DEFAULT FALSE,
  is_halal BOOLEAN NOT NULL DEFAULT TRUE,
  spice_level TINYINT NOT NULL DEFAULT 0,    -- 0 none .. 3 very spicy
  has_nuts BOOLEAN NOT NULL DEFAULT FALSE,
  iftar_only BOOLEAN NOT NULL DEFAULT FALSE, -- only orderable while Ramadan mode is on
  surplus_eligible BOOLEAN NOT NULL DEFAULT TRUE,
=======
  is_veg TINYINT(1) NOT NULL DEFAULT 1,   -- 1 = vegetarian, 0 = non-vegetarian
  availability VARCHAR(12) NOT NULL DEFAULT 'available',   -- available | sold_out | hidden
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  discount_applied BOOLEAN NOT NULL DEFAULT FALSE,
  refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  pickup_slot VARCHAR(5) NULL,                 -- e.g. '13:10' (10-minute pickup window)
  picked_up_at TIMESTAMP NULL,                 -- set when the admin scans the QR / enters the code
  ready_at TIMESTAMP NULL,
  surplus_savings DECIMAL(10,2) NOT NULL DEFAULT 0,
  kind VARCHAR(10) NOT NULL DEFAULT 'own',     -- own | group | treat
  group_id INT NULL,
  label VARCHAR(160) NULL,                     -- e.g. "Treat from Rahim" / "Group: Lab buddies"
  points_awarded BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method ENUM('wallet','cash','bkash','nagad') NOT NULL,
  status ENUM('Received','Cooking','Ready','Confirmed','Cancelled','Refunded') NOT NULL DEFAULT 'Received',
=======
  discount_applied TINYINT(1) NOT NULL DEFAULT 0,
  payment_method ENUM('wallet','cash') NOT NULL,
  pickup_time DATETIME NULL,  -- NULL = ASAP; otherwise a scheduled pickup time (feature: pre-order)
  note VARCHAR(255) NULL,     -- optional note for the kitchen, e.g. "less spicy"
  status ENUM('Received','Cooking','Ready','Cancelled') NOT NULL DEFAULT 'Received',
>>>>>>> Stashed changes
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
  original_price DECIMAL(10,2) NULL,   -- set when a last-hour surplus deal applied
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
  owner_user_id INT NULL,               -- personal reward coupons only work for this user
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

CREATE TABLE IF NOT EXISTS notification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT,
  notification_type VARCHAR(30) NOT NULL DEFAULT 'order',
  status VARCHAR(30),
  message VARCHAR(255),
  read_at TIMESTAMP NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, sent_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  k VARCHAR(50) PRIMARY KEY,
  v VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_shares (      -- who actually paid for an order (group / treat orders)
  order_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, user_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS class_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  weekday TINYINT NOT NULL,                    -- 0 = Sunday .. 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title VARCHAR(80) NOT NULL,
  INDEX idx_sched_user (user_id, weekday),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  host_id INT NOT NULL,
  name VARCHAR(60) NOT NULL,
  split_mode ENUM('equal','own') NOT NULL DEFAULT 'equal',
  status ENUM('open','placed','cancelled') NOT NULL DEFAULT 'open',
  meal_date DATE NOT NULL,
  pickup_slot VARCHAR(5) NULL,
  order_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES group_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS group_items (
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  qty INT NOT NULL,
  PRIMARY KEY (group_id, user_id, menu_item_id),
  FOREIGN KEY (group_id) REFERENCES group_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS treats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_user INT NOT NULL,
  to_user INT NOT NULL,
  kind ENUM('credit','meal') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  order_id INT NULL,
  message VARCHAR(140),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_treat_from (from_user), INDEX idx_treat_to (to_user),
  FOREIGN KEY (from_user) REFERENCES users(id),
  FOREIGN KEY (to_user) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS loyalty (
  user_id INT PRIMARY KEY,
  points INT NOT NULL DEFAULT 0,
  lifetime_points INT NOT NULL DEFAULT 0,
  streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  last_date DATE NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS points_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  points INT NOT NULL,
  reason VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_points_user (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT IGNORE INTO app_settings (k, v) VALUES ('slot_lock', '1');

-- ---------- Seed data ----------

INSERT INTO meal_rates (role, full_rate, half_rate) VALUES
  ('student', 90, 50),
  ('teacher', 130, 70)
ON DUPLICATE KEY UPDATE full_rate = VALUES(full_rate), half_rate = VALUES(half_rate);

INSERT INTO menu_items (name, name_bn, category, price, stock, tag)
SELECT * FROM (SELECT 'Khichuri' AS name, 'খিচুড়ি' AS name_bn, 'heavy' AS category, 60 AS price, 40 AS stock, 'Popular' AS tag) AS seed WHERE NOT EXISTS (SELECT 1 FROM menu_items);
INSERT INTO menu_items (name, name_bn, category, price, stock, tag) SELECT * FROM (SELECT 'Tehari' a,'তেহারি' b,'heavy' c,80 d,25 e,'Popular' f UNION ALL SELECT 'Porota-Vaji','পরোটা-ভাজি','heavy',40,6,NULL UNION ALL SELECT 'Plain Rice & Dal','ভাত-ডাল','heavy',45,30,NULL UNION ALL SELECT 'Singara','সিঙ্গারা','snacks',10,60,'New' UNION ALL SELECT 'Fuchka','ফুচকা','snacks',30,4,'Popular' UNION ALL SELECT 'Chicken Roll','চিকেন রোল','snacks',50,20,NULL UNION ALL SELECT 'Cha (Tea)','চা','drinks',8,120,NULL UNION ALL SELECT 'Lassi','লাচ্ছি','drinks',35,15,'New' UNION ALL SELECT 'Mineral Water','পানি','drinks',15,50,NULL) t WHERE (SELECT COUNT(*) FROM menu_items) = 1;
-- (original seed list kept below for reference)
/*
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
*/

INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, expiry_date, description, is_active)
VALUES ('CAMPUS10', 'PERCENTAGE', 10, 50, 100, 1000, DATE_ADD(NOW(), INTERVAL 1 YEAR), '10% off for campus orders', 1)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), expiry_date = VALUES(expiry_date);

-- No demo user accounts are seeded here on purpose: password_hash must be a real
-- bcrypt hash, and one can't be safely hand-written in a SQL file. Instead, create
-- your student/teacher/admin accounts through the running API — see Step 6 in the
-- README ("Register your first users") — which hashes the password correctly.

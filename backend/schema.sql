SET NAMES utf8mb4;
-- CampusDine database schema
-- Run:  mysql -u root -p campusdine < schema.sql
-- (create the database first: CREATE DATABASE campusdine;)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NULL UNIQUE,            -- collected at sign-up; also usable to log in and to reset a password
  external_id VARCHAR(50) NOT NULL UNIQUE,   -- student/teacher/admin ID used to log in
  role ENUM('student','teacher','admin','rider') NOT NULL,
  account_type ENUM('regular','hall') NOT NULL DEFAULT 'regular',  -- 'hall' = lives in a hall (has hall_name, room_number, hall_id)
  password_hash VARCHAR(255) NOT NULL,
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  phone VARCHAR(20) NULL,
  address VARCHAR(255) NULL,
  department VARCHAR(100) NULL,
  father_phone VARCHAR(20) NULL,
  hall_name VARCHAR(60) NULL,                -- which hall the resident lives in
  room_number VARCHAR(20) NULL,              -- hall room number (given at hall sign-up or from the profile)
  hall_id VARCHAR(20) NULL UNIQUE,           -- auto-assigned once a room number is first saved; fixed after that
  avatar MEDIUMTEXT NULL,                    -- profile picture (small base64 data-URL)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature: extended profile (phone/address/department/father's number) + hall
-- room number with an auto-assigned fixed Hall ID. For an existing 'campusdine'
-- DB created before this change, run once:
--   ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER wallet_balance;
--   ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER phone;
--   ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL AFTER address;
--   ALTER TABLE users ADD COLUMN father_phone VARCHAR(20) NULL AFTER department;
--   ALTER TABLE users ADD COLUMN room_number VARCHAR(20) NULL AFTER father_phone;
--   ALTER TABLE users ADD COLUMN hall_id VARCHAR(20) NULL UNIQUE AFTER room_number;

-- Feature: email + hall-resident accounts + QR pickup. The server adds these automatically on start
-- (see ensureAccountAndQrSchema in server.js); to do it by hand on an existing DB, run once:
--   ALTER TABLE users ADD COLUMN email VARCHAR(120) NULL;
--   ALTER TABLE users ADD UNIQUE KEY uniq_users_email (email);
--   ALTER TABLE users ADD COLUMN account_type ENUM('regular','hall') NOT NULL DEFAULT 'regular';
--   ALTER TABLE users ADD COLUMN hall_name VARCHAR(60) NULL;
--   ALTER TABLE orders ADD COLUMN picked_up_at DATETIME NULL;
--   UPDATE users SET account_type = 'hall' WHERE hall_id IS NOT NULL;

-- Feature: meal plan. The server adds these on start; by hand on an existing DB, run once:
--   ALTER TABLE meal_calendar ADD COLUMN paid_amount DECIMAL(10,2) NULL;
--   ALTER TABLE meal_calendar ADD COLUMN paid_at DATETIME NULL;

-- Feature: veg / non-veg marking. For an existing 'campusdine' DB, run once:
--   ALTER TABLE menu_items ADD COLUMN is_veg TINYINT(1) NOT NULL DEFAULT 1 AFTER tag;
--   UPDATE menu_items SET is_veg = 0 WHERE name IN ('Tehari', 'Chicken Roll');

-- Feature: favorites / wishlist — which menu items a student has starred.
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
  is_veg TINYINT(1) NOT NULL DEFAULT 1,   -- 1 = vegetarian, 0 = non-vegetarian
  availability VARCHAR(12) NOT NULL DEFAULT 'available',   -- available | sold_out | hidden
  image VARCHAR(200) NULL,                 -- local image path, e.g. /images/food/tehari.svg
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The app currently stores favorites in a table named `favourites` with `item_id`
-- to match the live production database. Keep the column naming compatible with
-- the route code to avoid runtime 500s when fetching the menu.
CREATE TABLE IF NOT EXISTS favourites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_item (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_applied TINYINT(1) NOT NULL DEFAULT 0,
  payment_method ENUM('wallet','cash') NOT NULL,
  pickup_time DATETIME NULL,  -- NULL = ASAP; otherwise a scheduled pickup time (feature: pre-order)
  note VARCHAR(255) NULL,     -- optional note for the kitchen, e.g. "less spicy"
  status ENUM('Received','Cooking','Ready','Cancelled') NOT NULL DEFAULT 'Received',
  rider_id INT NULL,
  rider_assignment_status ENUM('Unassigned','Assigned','Accepted','Declined','Completed') NOT NULL DEFAULT 'Unassigned',
  delivery_lat DECIMAL(10,7) NULL,
  delivery_lng DECIMAL(10,7) NULL,
  picked_up_at DATETIME NULL, -- set when the counter scans the QR and hands the order over
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
  active_key TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'ON_DUTY' THEN 1 ELSE NULL END) STORED,
  UNIQUE KEY uq_rider_one_active_shift (rider_id, active_key),
  KEY idx_rider_shift_status (rider_id, status),
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Feature: order cancel + refund. If you created the database before this
-- change, run this once against an existing 'campusdine' DB — CREATE TABLE
-- IF NOT EXISTS above won't retrofit an existing orders table:
--   ALTER TABLE orders MODIFY status ENUM('Received','Cooking','Ready','Cancelled') NOT NULL DEFAULT 'Received';

-- Feature: pre-order / scheduled pickup. For an existing 'campusdine' DB
-- created before this change, run once:
--   ALTER TABLE orders ADD COLUMN pickup_time DATETIME NULL AFTER payment_method;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT,
  name VARCHAR(100) NOT NULL,   -- snapshot at order time
  price DECIMAL(10,2) NOT NULL, -- snapshot at order time
  qty INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(150) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,  -- positive = credit, negative = debit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS meal_calendar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  the_date DATE NOT NULL,
  status ENUM('off','full','half') NOT NULL DEFAULT 'off',
  paid_amount DECIMAL(10,2) NULL,   -- meal plan: what this day cost when paid from the wallet (NULL = not paid yet)
  paid_at DATETIME NULL,
  UNIQUE KEY uniq_user_date (user_id, the_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Added: the feedback/rating feature (admin.js, orders.js) queries this
-- table, but it was missing from the schema — every feedback-related API
-- call (and any order list, since GET /api/orders[/mine] always attaches
-- feedback) failed with "Table 'campusdine.order_feedback' doesn't exist"
-- and crashed the whole server. See src/routes/orders.js and admin.js.
CREATE TABLE IF NOT EXISTS order_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL UNIQUE,   -- one feedback per order (drives ON DUPLICATE KEY UPDATE)
  user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- General (not order-linked) feedback: lets a student/teacher share a
-- suggestion or complaint even when they have no completed order to rate.
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
ON DUPLICATE KEY UPDATE full_rate = VALUES(full_rate), half_rate = VALUES(half_rate);

-- Seed menu only when the table is empty, so importing this file twice can't create duplicate items.
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

-- No demo user accounts are seeded here on purpose: password_hash must be a real
-- bcrypt hash, and one can't be safely hand-written in a SQL file. Instead, create
-- your student/teacher/admin accounts through the running API — see Step 6 in the
-- README ("Register your first users") — which hashes the password correctly.
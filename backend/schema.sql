-- CampusDine database schema
-- Run:  mysql -u root -p campusdine < schema.sql
-- (create the database first: CREATE DATABASE campusdine;)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  external_id VARCHAR(50) NOT NULL UNIQUE,   -- student/teacher/admin ID used to log in
  role ENUM('student','teacher','admin') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  payment_method ENUM('wallet','cash') NOT NULL,
  status ENUM('Received','Cooking','Ready','Cancelled') NOT NULL DEFAULT 'Received',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Feature: order cancel + refund. If you created the database before this
-- change, run this once against an existing 'campusdine' DB — CREATE TABLE
-- IF NOT EXISTS above won't retrofit an existing orders table:
--   ALTER TABLE orders MODIFY status ENUM('Received','Cooking','Ready','Cancelled') NOT NULL DEFAULT 'Received';

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

-- No demo user accounts are seeded here on purpose: password_hash must be a real
-- bcrypt hash, and one can't be safely hand-written in a SQL file. Instead, create
-- your student/teacher/admin accounts through the running API — see Step 6 in the
-- README ("Register your first users") — which hashes the password correctly.
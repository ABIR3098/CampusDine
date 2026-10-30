-- CampusDine Campus Command Center additions.
-- The Express route also creates these tables lazily on first use.

CREATE TABLE IF NOT EXISTS campus_lost_found (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_type ENUM('lost','found') NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  location VARCHAR(180) NOT NULL,
  contact VARCHAR(100) NULL,
  image_data MEDIUMTEXT NULL,
  status ENUM('open','claimed','returned','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lost_found_status(status),
  KEY idx_lost_found_created(created_at),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campus_emergencies (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  emergency_type VARCHAR(60) NOT NULL,
  details VARCHAR(1000) NULL,
  location VARCHAR(180) NOT NULL,
  contact VARCHAR(100) NULL,
  status ENUM('open','acknowledged','responding','resolved','false_alarm') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_emergency_status(status),
  KEY idx_emergency_created(created_at),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campus_waste_challenge_members (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  saved_meals INT NOT NULL DEFAULT 0,
  last_pledge_date DATE NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campus_food_waste (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  restaurant_id VARCHAR(30) NOT NULL DEFAULT 'amitie',
  meal_name VARCHAR(120) NOT NULL,
  cooked_portions INT NOT NULL,
  leftover_portions INT NOT NULL,
  notes VARCHAR(500) NULL,
  waste_percent DECIMAL(6,2) NOT NULL,
  log_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_waste_date(log_date),
  KEY idx_waste_restaurant_date(restaurant_id,log_date)
);

async function ensureHallExtraSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hall_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('maintenance','cleaning','laundry','guest','lost_found','facility_booking','feedback','emergency','event') NOT NULL,
    title VARCHAR(180) NOT NULL, description TEXT NULL, location VARCHAR(180) NULL, requested_date DATE NULL,
    status ENUM('submitted','approved','in_progress','resolved','rejected','cancelled') NOT NULL DEFAULT 'submitted',
    admin_note VARCHAR(500) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hall_req_type_status (type,status), INDEX idx_hall_req_user (user_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS hall_notices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, title VARCHAR(180) NOT NULL, body TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'General', pinned TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NULL, created_by INT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hall_notice_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS hall_inventory (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(180) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'General', quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(30) NOT NULL DEFAULT 'pcs', min_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_by INT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_hall_inventory_item (item_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS hall_pickup_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, the_date DATE NOT NULL, slot ENUM('breakfast','lunch','dinner') NOT NULL,
    token_code VARCHAR(24) NOT NULL UNIQUE, status ENUM('issued','served','cancelled') NOT NULL DEFAULT 'issued',
    served_by INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, served_at DATETIME NULL,
    UNIQUE KEY uniq_hall_pickup_user_meal (user_id,the_date,slot),
    INDEX idx_hall_pickup_queue (the_date,slot,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS hall_food_waste (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    waste_date DATE NOT NULL, slot ENUM('breakfast','lunch','dinner') NOT NULL,
    prepared_plates INT NOT NULL DEFAULT 0, served_plates INT NOT NULL DEFAULT 0,
    wasted_plates INT NOT NULL DEFAULT 0, notes VARCHAR(500) NULL, recorded_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hall_waste_date (waste_date,slot)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS hall_audit_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL, entity_type VARCHAR(60) NOT NULL, entity_id BIGINT NULL,
    details JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hall_audit_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Add tenant key to existing tables without breaking previously installed Hall data.
  for (const table of ['hall_requests','hall_notices','hall_inventory','hall_pickup_tokens','hall_food_waste','hall_audit_log']) {
    const [cols] = await db.query(`SHOW COLUMNS FROM ${table} LIKE 'university_id'`);
    if (!cols.length) await db.query(`ALTER TABLE ${table} ADD COLUMN university_id BIGINT UNSIGNED NULL`);
  }
  const [idx] = await db.query("SHOW INDEX FROM hall_inventory WHERE Key_name='uniq_hall_inventory_item'");
  if (idx.length) await db.query('ALTER TABLE hall_inventory DROP INDEX uniq_hall_inventory_item');
  const [tenantIdx] = await db.query("SHOW INDEX FROM hall_inventory WHERE Key_name='uq_hall_inventory_tenant_item'");
  if (!tenantIdx.length) await db.query('ALTER TABLE hall_inventory ADD UNIQUE KEY uq_hall_inventory_tenant_item (university_id,item_name)');
}
module.exports = { ensureHallExtraSchema };

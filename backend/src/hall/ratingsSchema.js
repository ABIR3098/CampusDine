// Meal ratings: one row per person, date and meal (rating again just updates the row).
// Run from hall/index.js every time the server starts (safe to repeat).
async function ensureHallRatingsSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hall_meal_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    the_date DATE NOT NULL,
    slot VARCHAR(12) NOT NULL,
    stars TINYINT NOT NULL,              -- 1 to 5
    comment VARCHAR(300) NULL,
    created_at DATETIME NOT NULL,        -- canteen clock
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uniq_rating_user_date_slot (user_id, the_date, slot),
    KEY idx_rating_date_slot (the_date, slot),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
}

module.exports = { ensureHallRatingsSchema };

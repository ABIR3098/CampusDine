// Diet preferences: what a person doesn't eat and what they are allergic to.
// Run from hall/index.js every time the server starts (safe to repeat).
async function ensureHallDietSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hall_diet (
    user_id INT NOT NULL PRIMARY KEY,
    avoid VARCHAR(200) NOT NULL DEFAULT '',       -- comma list of tag keys they prefer not to eat, e.g. "beef,fish"
    allergies VARCHAR(200) NOT NULL DEFAULT '',   -- comma list of tag keys they are allergic to
    note VARCHAR(160) NULL,
    updated_at DATETIME NOT NULL,                 -- canteen clock
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
}

module.exports = { ensureHallDietSchema };

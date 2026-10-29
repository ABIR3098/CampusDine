// Mess finance: what the hall spends (food, gas, wages ...). Income comes from the bills that already exist.
// Run from hall/index.js every time the server starts (safe to repeat).
async function ensureHallFinanceSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hall_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(30) NOT NULL,           -- see CATEGORIES in routes/finance.js
    amount DECIMAL(10,2) NOT NULL,
    supplier_id BIGINT UNSIGNED NULL,        -- optional: which supplier it was bought from
    note VARCHAR(255) NULL,
    created_by INT NOT NULL,
    university_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL,            -- canteen clock
    KEY idx_expense_date (expense_date),
    KEY idx_expense_uni_date (university_id, expense_date)
  )`);
}

module.exports = { ensureHallFinanceSchema };

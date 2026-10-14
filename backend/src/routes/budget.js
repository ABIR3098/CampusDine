const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { budgetReport } = require("../utils/budget");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher"));

router.get("/", async (req, res) => res.json(await budgetReport(pool, req.user.id)));

// PUT { weeklyBudget: 600 }  (null or 0 removes the limit)
router.put("/", async (req, res) => {
  const raw = req.body.weeklyBudget;
  let value = null;
  if (raw !== null && raw !== undefined && Number(raw) !== 0) {
    value = Math.round(Number(raw) * 100) / 100;
    if (!Number.isFinite(value) || value < 50 || value > 100000) return res.status(400).json({ error: "Weekly budget must be between ৳50 and ৳100000 (or empty to remove it)" });
  }
  await pool.query("UPDATE users SET weekly_budget = ? WHERE id = ?", [value, req.user.id]);
  res.json(await budgetReport(pool, req.user.id));
});

module.exports = router;

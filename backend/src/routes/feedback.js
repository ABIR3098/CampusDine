const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
const CATEGORIES = ["food", "service", "hygiene", "suggestion", "other"];

router.use(verifyToken, requireRole("student", "teacher"));

// POST /api/feedback — general feedback that isn't tied to one order
// body: { rating: 1-5, category, comment? }
router.post("/", catchAsync(async (req, res) => {
  const rating = Number(req.body.rating);
  const category = CATEGORIES.includes(req.body.category) ? req.body.category : "other";
  const comment = String(req.body.comment || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "rating must be an integer from 1 to 5" });
  }
  if (comment.length > 500) {
    return res.status(400).json({ error: "Comment must be 500 characters or fewer" });
  }

  const [result] = await pool.query(
    "INSERT INTO general_feedback (user_id, category, rating, comment) VALUES (?, ?, ?, ?)",
    [req.user.id, category, rating, comment || null]
  );

  const io = req.app.get("io");
  if (io) {
    io.to("admins").emit("feedback:new", {
      id: result.insertId,
      kind: "general",
      category,
      rating,
      userName: req.user.name,
    });
  }

  res.status(201).json({ id: result.insertId, category, rating, comment: comment || null });
}));

// GET /api/feedback/mine — this user's own general feedback, newest first
router.get("/mine", catchAsync(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, category, rating, comment, created_at FROM general_feedback WHERE user_id = ? ORDER BY id DESC LIMIT 50",
    [req.user.id]
  );
  res.json(rows);
}));

module.exports = router;

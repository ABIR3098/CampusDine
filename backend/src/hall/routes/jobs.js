const express = require("express");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { runAutoFill } = require("../jobs");

const router = express.Router();

// POST /api/hall/auto-fill  (admin) — run the cut-off job right now (it also runs by itself every minute)
router.post("/auto-fill", requireRole("admin"), catchAsync(async (req, res) => {
  const done = await runAutoFill();
  res.json({ ran: done, totalAdded: done.reduce((a, d) => a + d.added, 0) });
}));

module.exports = router;

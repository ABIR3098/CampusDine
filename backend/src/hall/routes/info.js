const express = require("express");
const catchAsync = require("../../utils/catchAsync");
const { TZ } = require("../../utils/clock");
const { nowParts } = require("../util");

const router = express.Router();

// GET /api/hall/info — who is asking + the canteen's clock (the Hall home page uses it)
router.get("/info", catchAsync(async (req, res) => {
  const now = nowParts();
  res.json({
    name: "Hall",
    role: req.user.role,
    userName: req.user.name,
    today: now.dateKey,
    minutes: now.minutes,
    timezone: TZ,
  });
}));

module.exports = router;

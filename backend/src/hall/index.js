// Hall meal management and services share the CampusDine login; wallet and payment routes are excluded.
const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { ensureHallSchema } = require("./schema");
const pool = require("../db");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher", "admin"));
// Hall students must have registered a Hall account; teachers/admins keep their existing access.
router.use(async (req, res, next) => {
  if (req.user.role !== "student") return next();
  try {
    const [rows] = await pool.query("SELECT account_type FROM users WHERE id = ?", [req.user.id]);
    if (!rows.length || rows[0].account_type !== "hall") {
      return res.status(403).json({ error: "This module is for Hall Student accounts. Register/update your account as Hall first." });
    }
    next();
  } catch (e) { next(e); }
});

router.use("/", require("./routes/info"));
router.use("/", require("./routes/slots")); // step 2
router.use("/", require("./routes/meals")); // step 3
router.use("/", require("./routes/jobs")); // step 5
router.use("/", require("./routes/menu")); // step 6
router.use("/", require("./routes/feasts")); // step 7
router.use("/", require("./routes/guests")); // step 8
router.use("/", require("./routes/services"));
router.use("/", require("./routes/report")); // step 12
// (each step adds its router here)

// background jobs (started once after the server is listening)
function startJobs() {
  require("./jobs").startAutoFill(); // step 5
}

module.exports = { router, ensureHallSchema, startJobs };

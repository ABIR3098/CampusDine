// Hall = the meal system (students & teachers switch each meal on/off, weekly menu, feasts, monthly bill).
// It sits next to the four restaurants and shares the same login and wallet.
const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { ensureHallSchema } = require("./schema");
const { ensureHallRatingsSchema } = require("./ratingsSchema");
const { ensureHallAutoPaySchema } = require("./autopaySchema");
const pool = require("../db");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher", "admin"));
// Hall students must have registered a Hall account; teachers/admins keep their existing access.
router.use(async (req, res, next) => {
  try {
    if (req.user.role !== "student") { const [rows] = await pool.query("SELECT university_id FROM users WHERE id = ?", [req.user.id]); req.user.universityId = rows[0]?.university_id || null; return next(); }
    const [rows] = await pool.query("SELECT account_type, university_id FROM users WHERE id = ?", [req.user.id]);
    if (!rows.length || rows[0].account_type !== "hall") {
      return res.status(403).json({ error: "This module is for Hall Student accounts. Register/update your account as Hall first." });
    }
    req.user.universityId = rows[0].university_id || null;
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
router.use("/", require("./routes/bill")); // step 10: monthly bill
router.use("/", require("./routes/ratings")); // meal ratings (student)
router.use("/", require("./routes/ratingsReport")); // meal ratings summary (admin)
router.use("/", require("./routes/autopay")); // auto-pay of the monthly bill
router.use("/", require("./routes/defaulters")); // who still owes money (admin)
router.use("/", require("./routes/report")); // step 12
router.use("/", require("./routes/tokens")); // student meal token and canteen serving queue
router.use("/", require("./routes/services"));
router.use("/", require("./advanced"));
// (each step adds its router here)

// background jobs (started once after the server is listening)
function startJobs() {
  require("./jobs").startAutoFill(); // step 5
  require("./autopay").startAutoPay(); // pays last month's bill for people who turned auto-pay on
}

// server.js calls ensureHallSchema once at start-up, so the ratings table is created together with the rest.
async function ensureAllHallSchema(db) {
  await ensureHallSchema(db);
  await ensureHallRatingsSchema(db);
  await ensureHallAutoPaySchema(db);
}

module.exports = { router, ensureHallSchema: ensureAllHallSchema, startJobs };

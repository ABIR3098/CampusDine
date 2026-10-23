// Hall = the meal system (students & teachers switch each meal on/off, weekly menu, feasts, monthly bill).
// It sits next to the four restaurants and shares the same login and wallet.
const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { ensureHallSchema } = require("./schema");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher", "admin"));

router.use("/", require("./routes/info"));
router.use("/", require("./routes/slots")); // step 2
router.use("/", require("./routes/meals")); // step 3
router.use("/", require("./routes/jobs")); // step 5
router.use("/", require("./routes/menu")); // step 6
router.use("/", require("./routes/feasts")); // step 7
router.use("/", require("./routes/guests")); // step 8
router.use("/", require("./routes/bill")); // step 10
// (each step adds its router here)

// background jobs (started once after the server is listening)
function startJobs() {
  require("./jobs").startAutoFill(); // step 5
}

module.exports = { router, ensureHallSchema, startJobs };

// CampusDine Route: Vendor Settlements & Commission API
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const settlementController = require("../controllers/settlementController");

router.get("/overview", verifyToken, requireRole("admin"), settlementController.getOverview);
router.post("/reconcile/:vendorId", verifyToken, requireRole("admin"), settlementController.reconcileVendor);
router.post("/disburse", verifyToken, requireRole("admin"), settlementController.disburse);

module.exports = router;

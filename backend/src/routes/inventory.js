const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const rules = require("../inventory/rules");
const { HttpError } = require("../inventory/service");

// Staff can read stock and send reports/requests. Only admins can decide, record purchases or change stock.
function createInventoryRouter(service) {
  const router = express.Router();
  const fail = (res, message, status = 400) => res.status(status).json({ error: message });

  router.use(verifyToken);
  router.use((err, req, res, next) => next(err));

  // ───── Staff + Admin: read-only stock list ─────
  router.get("/items", requireRole("staff", "admin"), catchAsync(async (req, res) => {
    res.json({ items: await service.listItems() });
  }));


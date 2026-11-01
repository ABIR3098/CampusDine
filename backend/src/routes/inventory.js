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

  // ───── Staff: send a stock report / purchase request, see own requests with admin reply and updated stock ─────
  router.post("/requests", requireRole("staff"), catchAsync(async (req, res) => {
    const v = rules.validateStaffRequest(req.body);
    if (v.error) return fail(res, v.error);
    const created = await service.createRequest(req.user.id, v.value);
    const io = req.app && req.app.get && req.app.get("io");
    if (io) io.to("admins").emit("inventory:request", { id: created.id, itemName: created.itemName, staffName: created.staffName });
    res.status(201).json({ request: created });
  }));

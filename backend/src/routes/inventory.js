const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const rules = require("../inventory/rules");
const { HttpError } = require("../inventory/service");
const { describeDbError } = require("../inventory/errors");

// Staff can read stock and send reports/requests. Only admins can decide, record purchases or change stock.
function createInventoryRouter(service) {
  const router = express.Router();
  const fail = (res, message, status = 400) => res.status(status).json({ error: message });

  router.use(verifyToken);

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

  router.get("/requests/mine", requireRole("staff"), catchAsync(async (req, res) => {
    res.json({ requests: await service.listStaffRequests(req.user.id) });
  }));

  // ───── Staff: record what was used today. The system deducts it from the official stock. ─────
  router.post("/usage", requireRole("staff"), catchAsync(async (req, res) => {
    const v = rules.validateUsage(req.body);
    if (v.error) return fail(res, v.error);
    const result = await service.recordUsage(req.user.id, v.value);
    const io = req.app && req.app.get && req.app.get("io");
    if (io && result.level !== "ok") io.to("admins").emit("inventory:alert", { itemName: result.itemName, level: result.level, stock: result.stockAfter, unit: result.unit });
    res.status(201).json(result);
  }));

  router.get("/usage/mine", requireRole("staff"), catchAsync(async (req, res) => {
    res.json({ usage: await service.listStaffUsage(req.user.id) });
  }));

  // ───── Admin ─────
  router.get("/admin/usage", requireRole("admin"), catchAsync(async (req, res) => {
    res.json({ usage: await service.listAllUsage() });
  }));

  router.get("/admin/summary", requireRole("admin"), catchAsync(async (req, res) => {
    res.json(await service.summary());
  }));

  router.get("/admin/requests", requireRole("admin"), catchAsync(async (req, res) => {
    const status = rules.REQUEST_STATUSES.includes(req.query.status) ? req.query.status : null;
    res.json({ requests: await service.listAllRequests(status) });
  }));

  router.post("/admin/requests/:id/decision", requireRole("admin"), catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Invalid request id.");
    const v = rules.validateDecision(req.body);
    if (v.error) return fail(res, v.error);
    const updated = await service.decide(req.user.id, id, v.value);
    const io = req.app && req.app.get && req.app.get("io");
    if (io) io.to(`user:${updated.staffId}`).emit("inventory:decision", { id: updated.id, status: updated.status, adminReply: updated.adminReply, itemName: updated.itemName });
    res.json({ request: updated });
  }));

  router.post("/admin/purchases", requireRole("admin"), catchAsync(async (req, res) => {
    const v = rules.validatePurchase(req.body);
    if (v.error) return fail(res, v.error);
    const result = await service.recordPurchase(req.user.id, v.value);
    const io = req.app && req.app.get && req.app.get("io");
    if (io && result.requestId) {
      const request = await service.getRequest(result.requestId);
      if (request) io.to(`user:${request.staffId}`).emit("inventory:decision", { id: request.id, status: request.status, adminReply: request.adminReply, itemName: request.itemName });
    }
    res.status(201).json(result);
  }));

  router.get("/admin/purchases", requireRole("admin"), catchAsync(async (req, res) => {
    res.json({ purchases: await service.listPurchases() });
  }));

  router.post("/admin/items", requireRole("admin"), catchAsync(async (req, res) => {
    const v = rules.validateNewItem(req.body);
    if (v.error) return fail(res, v.error);
    res.status(201).json({ item: await service.addItem(req.user.id, v.value) });
  }));

  router.post("/admin/items/:id/adjust", requireRole("admin"), catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Invalid item id.");
    const v = rules.validateAdjustment(req.body);
    if (v.error) return fail(res, v.error);
    res.json(await service.adjustStock(req.user.id, id, v.value));
  }));

  router.get("/admin/history", requireRole("admin"), catchAsync(async (req, res) => {
    const itemId = Number(req.query.itemId);
    res.json({ history: await service.listHistory(Number.isInteger(itemId) && itemId > 0 ? itemId : null) });
  }));

  // Turn HttpError into a clean JSON response; anything else goes to the app-wide handler.
  router.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error("[inventory] " + req.method + " " + req.originalUrl + " failed:", err && err.sqlMessage ? err.sqlMessage : err);
    const detail = describeDbError(err);
    if (detail) return res.status(500).json({ error: detail });
    next(err);
  });

  return router;
}

module.exports = { createInventoryRouter };

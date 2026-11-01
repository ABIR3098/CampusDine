// All inventory database work lives here. Every stock change happens inside a transaction with the item row
// locked (SELECT ... FOR UPDATE) and always writes a row to inventory_stock_history.

const { canTransition, stockLevel } = require("./rules");

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const itemView = (r) => ({
  id: r.id, name: r.name, nameBn: r.name_bn, category: r.category, unit: r.unit,
  currentStock: Number(r.current_stock), minStock: Number(r.min_stock),
  level: stockLevel(r.current_stock, r.min_stock), updatedAt: r.updated_at,
});

const requestView = (r) => ({
  id: r.id, staffId: r.staff_id, staffName: r.staff_name || null, itemId: r.item_id,
  itemName: r.item_name, itemNameBn: r.item_name_bn || null, unit: r.unit,
  requestType: r.request_type, currentQty: Number(r.current_qty), requiredQty: Number(r.required_qty),
  note: r.note || "", status: r.status, adminReply: r.admin_reply || "",
  decidedAt: r.decided_at, createdAt: r.created_at, updatedAt: r.updated_at,
  officialStock: Number(r.official_stock),
  purchasedQty: r.purchased_qty === null || r.purchased_qty === undefined ? null : Number(r.purchased_qty),
  stockAfterPurchase: r.stock_after === null || r.stock_after === undefined ? null : Number(r.stock_after),
});

const REQUEST_SELECT = `SELECT q.*, i.name AS item_name, i.name_bn AS item_name_bn, i.unit, i.current_stock AS official_stock,
    u.name AS staff_name, p.quantity AS purchased_qty, h.stock_after AS stock_after
  FROM inventory_requests q
  JOIN inventory_items i ON i.id = q.item_id
  JOIN users u ON u.id = q.staff_id
  LEFT JOIN inventory_purchases p ON p.request_id = q.id
  LEFT JOIN inventory_stock_history h ON h.purchase_id = p.id`;

async function withTx(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore rollback failure */ }
    throw err;
  } finally {
    conn.release();
  }
}

function createService(pool) {
  async function listItems() {
    const [rows] = await pool.query("SELECT * FROM inventory_items ORDER BY category, name");
    return rows.map(itemView);
  }

  async function getRequest(id, conn = pool) {
    const [rows] = await conn.query(`${REQUEST_SELECT} WHERE q.id = ?`, [id]);
    return rows[0] ? requestView(rows[0]) : null;
  }

  async function createRequest(staffId, v) {
    const [items] = await pool.query("SELECT id FROM inventory_items WHERE id = ?", [v.itemId]);
    if (!items.length) throw new HttpError(404, "That raw material does not exist.");
    const [r] = await pool.query(
      "INSERT INTO inventory_requests (staff_id, item_id, request_type, current_qty, required_qty, note) VALUES (?, ?, ?, ?, ?, ?)",
      [staffId, v.itemId, v.requestType, v.currentQty, v.requiredQty, v.note || null]
    );
    return getRequest(r.insertId);
  }

  async function listStaffRequests(staffId) {
    const [rows] = await pool.query(`${REQUEST_SELECT} WHERE q.staff_id = ? ORDER BY q.created_at DESC, q.id DESC LIMIT 200`, [staffId]);
    return rows.map(requestView);
  }

  async function listAllRequests(status) {
    const where = status ? "WHERE q.status = ?" : "";
    const [rows] = await pool.query(`${REQUEST_SELECT} ${where} ORDER BY q.created_at DESC, q.id DESC LIMIT 300`, status ? [status] : []);
    return rows.map(requestView);
  }

  async function decide(adminId, requestId, v) {
    return withTx(pool, async (conn) => {
      const [rows] = await conn.query("SELECT id, status FROM inventory_requests WHERE id = ? FOR UPDATE", [requestId]);
      if (!rows.length) throw new HttpError(404, "Request not found.");
      if (!canTransition(rows[0].status, v.decision)) throw new HttpError(409, `This request is already ${rows[0].status}.`);
      await conn.query(
        "UPDATE inventory_requests SET status = ?, admin_id = ?, admin_reply = ?, decided_at = NOW() WHERE id = ?",
        [v.decision, adminId, v.reply || null, requestId]
      );
      return getRequest(requestId, conn);
    });
  }

  async function recordPurchase(adminId, v) {
    return withTx(pool, async (conn) => {
      let itemId = v.itemId;
      if (v.requestId) {
        const [reqRows] = await conn.query("SELECT id, item_id, status FROM inventory_requests WHERE id = ? FOR UPDATE", [v.requestId]);
        if (!reqRows.length) throw new HttpError(404, "Request not found.");
        if (!canTransition(reqRows[0].status, "purchased")) {
          throw new HttpError(409, reqRows[0].status === "pending" ? "Approve the request before recording the purchase." : `This request is already ${reqRows[0].status}.`);
        }
        if (itemId && Number(itemId) !== Number(reqRows[0].item_id)) throw new HttpError(400, "The item does not match the request.");
        itemId = reqRows[0].item_id;
      }
      const [itemRows] = await conn.query("SELECT id, current_stock FROM inventory_items WHERE id = ? FOR UPDATE", [itemId]);
      if (!itemRows.length) throw new HttpError(404, "That raw material does not exist.");
      const before = Number(itemRows[0].current_stock);
      const after = Math.round((before + v.quantity) * 100) / 100;

      const [p] = await conn.query(
        "INSERT INTO inventory_purchases (request_id, item_id, admin_id, quantity, unit_cost, total_cost, supplier, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [v.requestId || null, itemId, adminId, v.quantity, v.unitCost, v.totalCost, v.supplier || null, v.note || null]
      );
      await conn.query("UPDATE inventory_items SET current_stock = ? WHERE id = ?", [after, itemId]);
      await conn.query(
        "INSERT INTO inventory_stock_history (item_id, change_qty, stock_before, stock_after, reason, purchase_id, actor_id, note) VALUES (?, ?, ?, ?, 'purchase', ?, ?, ?)",
        [itemId, v.quantity, before, after, p.insertId, adminId, v.note || v.supplier || null]
      );
      if (v.requestId) {
        await conn.query("UPDATE inventory_requests SET status = 'purchased', admin_id = COALESCE(admin_id, ?) WHERE id = ?", [adminId, v.requestId]);
      }
      return { purchaseId: p.insertId, itemId, stockBefore: before, stockAfter: after, requestId: v.requestId || null };
    });
  }

  async function adjustStock(adminId, itemId, v) {
    return withTx(pool, async (conn) => {
      const [rows] = await conn.query("SELECT id, current_stock FROM inventory_items WHERE id = ? FOR UPDATE", [itemId]);
      if (!rows.length) throw new HttpError(404, "That raw material does not exist.");
      const before = Number(rows[0].current_stock);
      await conn.query("UPDATE inventory_items SET current_stock = ? WHERE id = ?", [v.newStock, itemId]);
      await conn.query(
        "INSERT INTO inventory_stock_history (item_id, change_qty, stock_before, stock_after, reason, actor_id, note) VALUES (?, ?, ?, ?, 'adjustment', ?, ?)",
        [itemId, Math.round((v.newStock - before) * 100) / 100, before, v.newStock, adminId, v.note]
      );
      return { itemId, stockBefore: before, stockAfter: v.newStock };
    });
  }

  async function addItem(adminId, v) {
    return withTx(pool, async (conn) => {
      const [dup] = await conn.query("SELECT id FROM inventory_items WHERE name = ?", [v.name]);
      if (dup.length) throw new HttpError(409, "An item with this name already exists.");
      const [r] = await conn.query(
        "INSERT INTO inventory_items (name, name_bn, category, unit, current_stock, min_stock) VALUES (?, ?, ?, ?, ?, ?)",
        [v.name, v.nameBn, v.category, v.unit, v.currentStock, v.minStock]
      );
      await conn.query(
        "INSERT INTO inventory_stock_history (item_id, change_qty, stock_before, stock_after, reason, actor_id, note) VALUES (?, ?, 0, ?, 'opening', ?, 'Item added')",
        [r.insertId, v.currentStock, v.currentStock, adminId]
      );
      const [rows] = await conn.query("SELECT * FROM inventory_items WHERE id = ?", [r.insertId]);
      return itemView(rows[0]);
    });
  }

  async function recordUsage(staffId, v) {
    return withTx(pool, async (conn) => {
      const [rows] = await conn.query("SELECT id, current_stock, min_stock, name, unit FROM inventory_items WHERE id = ? FOR UPDATE", [v.itemId]);
      if (!rows.length) throw new HttpError(404, "That raw material does not exist.");
      const before = Number(rows[0].current_stock);
      if (v.quantity > before) throw new HttpError(409, `Only ${before} ${rows[0].unit} of ${rows[0].name} is in stock, so ${v.quantity} ${rows[0].unit} cannot be used. Send a restock request.`);
      const after = Math.round((before - v.quantity) * 100) / 100;
      await conn.query("UPDATE inventory_items SET current_stock = ? WHERE id = ?", [after, v.itemId]);
      const [u] = await conn.query(
        "INSERT INTO inventory_usage (item_id, staff_id, quantity, usage_date, note, stock_before, stock_after) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [v.itemId, staffId, v.quantity, v.usageDate, v.note || null, before, after]
      );
      await conn.query(
        "INSERT INTO inventory_stock_history (item_id, change_qty, stock_before, stock_after, reason, actor_id, note) VALUES (?, ?, ?, ?, 'usage', ?, ?)",
        [v.itemId, -v.quantity, before, after, staffId, v.note || `Used on ${v.usageDate}`]
      );
  async function listPurchases() {
    const [rows] = await pool.query(
      `SELECT p.*, i.name AS item_name, i.unit, u.name AS admin_name
       FROM inventory_purchases p JOIN inventory_items i ON i.id = p.item_id LEFT JOIN users u ON u.id = p.admin_id
       ORDER BY p.purchased_at DESC, p.id DESC LIMIT 300`
    );
    return rows.map((r) => ({
      id: r.id, requestId: r.request_id, itemId: r.item_id, itemName: r.item_name, unit: r.unit,
      quantity: Number(r.quantity), unitCost: r.unit_cost === null ? null : Number(r.unit_cost),
      totalCost: r.total_cost === null ? null : Number(r.total_cost), supplier: r.supplier || "",
      note: r.note || "", adminName: r.admin_name || null, purchasedAt: r.purchased_at,
    }));
  }

  async function listHistory(itemId) {
    const where = itemId ? "WHERE h.item_id = ?" : "";
    const [rows] = await pool.query(
      `SELECT h.*, i.name AS item_name, i.unit, u.name AS actor_name
       FROM inventory_stock_history h JOIN inventory_items i ON i.id = h.item_id LEFT JOIN users u ON u.id = h.actor_id
       ${where} ORDER BY h.created_at DESC, h.id DESC LIMIT 300`,
      itemId ? [itemId] : []
    );
    return rows.map((r) => ({
      id: r.id, itemId: r.item_id, itemName: r.item_name, unit: r.unit, change: Number(r.change_qty),
      before: Number(r.stock_before), after: Number(r.stock_after), reason: r.reason,
      actorName: r.actor_name || null, note: r.note || "", createdAt: r.created_at,
    }));
  }

  async function summary() {
    const [[s]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM inventory_requests WHERE status = 'pending') AS pending,
              (SELECT COUNT(*) FROM inventory_items WHERE current_stock <= 0) AS out_of_stock,
              (SELECT COUNT(*) FROM inventory_items WHERE current_stock > 0 AND min_stock > 0 AND current_stock <= min_stock) AS low_stock,
              (SELECT COALESCE(SUM(total_cost), 0) FROM inventory_purchases WHERE purchased_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS month_spend`
    );
    return { pending: Number(s.pending), outOfStock: Number(s.out_of_stock), lowStock: Number(s.low_stock), monthSpend: Number(s.month_spend) };
  }

  return { listItems, createRequest, listStaffRequests, listAllRequests, getRequest, decide, recordPurchase, adjustStock, addItem, listPurchases, listHistory, summary };
}

module.exports = { createService, HttpError, itemView, requestView };

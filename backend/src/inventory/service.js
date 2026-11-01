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

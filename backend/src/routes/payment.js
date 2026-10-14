const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../db");
const { withTransaction } = require("../db");
const { verifyToken } = require("../middleware/auth");
const { notifyUser } = require("../utils/notify");

const router = express.Router();

const BKASH = { key: process.env.BKASH_APP_KEY, secret: process.env.BKASH_APP_SECRET, user: process.env.BKASH_USERNAME, pass: process.env.BKASH_PASSWORD };
const NAGAD = { id: process.env.NAGAD_MERCHANT_ID, key: process.env.NAGAD_MERCHANT_KEY };
const bkashReady = () => Object.values(BKASH).every(Boolean);
const nagadReady = () => Object.values(NAGAD).every(Boolean);
const APP_URL = process.env.APP_URL || "http://localhost:5000";
const TOPUP_LIMIT = Number(process.env.MAX_WALLET_TOPUP || 9999);
const HTTP = { timeout: 15000 };
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function walletTopup(method) {
  return (req, res) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > TOPUP_LIMIT) return res.status(400).json({ error: `Top-up must be between 1 and ${TOPUP_LIMIT}` });
    if (!(method === "bkash" ? bkashReady() : nagadReady())) return res.status(503).json({ error: `${method} wallet top-up is unavailable: configure gateway credentials` });
    return res.status(501).json({ error: `${method} wallet top-up adapter is ready but requires live gateway credentials` });
  };
}
router.post("/bkash/wallet-topup", verifyToken, walletTopup("bkash"));
router.post("/nagad/wallet-topup", verifyToken, walletTopup("nagad"));

// The amount ALWAYS comes from the order in the database — never from the client —
// and the order must belong to the caller and be unpaid.
async function loadPayableOrder(req, method) {
  const orderId = Number(req.body.orderId);
  if (!Number.isInteger(orderId)) throw { status: 400, message: "Invalid order ID" };
  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ? AND user_id = ?", [orderId, req.user.id]);
  if (!order) throw { status: 404, message: "Order not found" };
  if (order.status !== "Received") throw { status: 409, message: `Order is ${order.status} and cannot be paid` };
  if (order.payment_method !== method) throw { status: 400, message: `This order was placed with ${order.payment_method}, not ${method}` };
  return order;
}

// Marks a pending transaction paid exactly once and confirms the order.
async function settle(app, ref, gatewayField, gatewayTrx) {
  const info = await withTransaction(async (conn) => {
    const [[t]] = await conn.query("SELECT * FROM payment_transactions WHERE transaction_ref = ? FOR UPDATE", [ref]);
    if (!t) throw { status: 404, message: "Unknown transaction" };
    if (t.status === "SUCCESS") return { already: true, t };
    await conn.query(`UPDATE payment_transactions SET status = 'SUCCESS', ${gatewayField} = ? WHERE id = ?`, [gatewayTrx, t.id]);
    await conn.query("UPDATE orders SET status = 'Confirmed' WHERE id = ? AND status = 'Received'", [t.order_id]);
    return { already: false, t };
  });
  if (!info.already && info.t.order_id) {
    const io = app.get("io");
    io.to("admins").emit("order:update", { id: info.t.order_id, status: "Confirmed" });
    io.to(`user:${info.t.user_id}`).emit("order:update", { id: info.t.order_id, status: "Confirmed" });
    notifyUser(app, info.t.user_id, info.t.order_id, "Confirmed");
  }
  return info;
}

router.post("/bkash/initiate", verifyToken, async (req, res) => {
  if (!bkashReady()) return res.status(503).json({ error: "bKash payment is unavailable: configure BKASH credentials" });
  const order = await loadPayableOrder(req, "bkash");
  const token = (await axios.post("https://checkout.sandbox.bkash.com/api/checkout/token/grant", { app_key: BKASH.key, app_secret: BKASH.secret }, { ...HTTP, headers: { "Content-Type": "application/json", username: BKASH.user, password: BKASH.pass } })).data.id_token;
  const created = (await axios.post("https://checkout.sandbox.bkash.com/api/checkout/payment/create", {
    mode: "0011", payerReference: `ORDER_${order.id}`, callbackURL: `${APP_URL}/api/payment/bkash/callback`,
    amount: String(order.total), currency: "BDT", intent: "sale", merchantInvoiceNumber: `INV_${order.id}_${Date.now()}`,
  }, { ...HTTP, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })).data;
  await pool.query("INSERT INTO payment_transactions (user_id, order_id, payment_method, amount, status, transaction_ref) VALUES (?, ?, 'bkash', ?, 'PENDING', ?)", [req.user.id, order.id, order.total, created.paymentID]);
  res.json({ success: true, paymentID: created.paymentID, redirectUrl: created.bkashURL });
});

// bKash redirects the browser back with ?paymentID=..&status=.. (GET); POST is accepted too.
// We never trust `status` — we re-verify by executing the payment with bKash ourselves.
async function bkashCallback(req, res) {
  if (!bkashReady()) return res.status(503).json({ error: "bKash payment is unavailable: configure BKASH credentials" });
  const src = { ...req.query, ...req.body };
  const paymentID = String(src.paymentID || "");
  const [[t]] = await pool.query("SELECT id, status FROM payment_transactions WHERE transaction_ref = ? AND payment_method = 'bkash'", [paymentID]);
  if (!t) return res.status(404).json({ error: "Unknown payment" });
  if (t.status === "SUCCESS") return res.json({ success: true, message: "Payment already confirmed" });
  if (src.status !== "success") { await pool.query("UPDATE payment_transactions SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'", [t.id]); return res.status(400).json({ error: "Payment failed or cancelled" }); }
  const token = (await axios.post("https://checkout.sandbox.bkash.com/api/checkout/token/grant", { app_key: BKASH.key, app_secret: BKASH.secret }, { ...HTTP, headers: { "Content-Type": "application/json", username: BKASH.user, password: BKASH.pass } })).data.id_token;
  const exec = (await axios.post("https://checkout.sandbox.bkash.com/api/checkout/payment/execute", { paymentID }, { ...HTTP, headers: { Authorization: `Bearer ${token}` } })).data;
  if (exec.statusCode !== "0000") return res.status(400).json({ error: "Payment execution failed" });
  await settle(req.app, paymentID, "bkash_trx_id", exec.trxID);
  res.json({ success: true, message: "Payment successful" });
}
router.get("/bkash/callback", bkashCallback);
router.post("/bkash/callback", bkashCallback);

router.post("/nagad/initiate", verifyToken, async (req, res) => {
  if (!nagadReady()) return res.status(503).json({ error: "Nagad payment is unavailable: configure NAGAD credentials" });
  const order = await loadPayableOrder(req, "nagad");
  const uniqueId = `${order.id}_${Date.now()}`;
  await pool.query("INSERT INTO payment_transactions (user_id, order_id, payment_method, amount, status, transaction_ref) VALUES (?, ?, 'nagad', ?, 'PENDING', ?)", [req.user.id, order.id, order.total, uniqueId]);
  res.json({
    success: true, transactionId: uniqueId, paymentUrl: "https://api.nagad.com.bd/api/v1/checkout/initialize",
    payload: { merchantId: NAGAD.id, orderId: uniqueId, amount: order.total, currencyCode: "050", description: `CampusDine Order #${order.id}`, callbackURL: `${APP_URL}/api/payment/nagad/callback` },
    message: "Nagad payment initiated. Redirect to payment gateway.",
  });
});

// The callback is public (Nagad calls it), so it MUST be authenticated. Placeholder scheme: the gateway
// sends `signature` = HMAC-SHA256(NAGAD_MERCHANT_KEY, "<transactionId>|<statusCode>"). Replace with
// Nagad's real verification API before going live. Without a valid signature nothing is confirmed.
router.post("/nagad/callback", async (req, res) => {
  if (!nagadReady()) return res.status(503).json({ error: "Nagad payment is unavailable: configure NAGAD credentials" });
  const { transactionId, statusCode, signature } = req.body;
  const expected = crypto.createHmac("sha256", NAGAD.key).update(`${transactionId}|${statusCode}`).digest("hex");
  if (!signature || !safeEq(signature, expected)) return res.status(401).json({ error: "Invalid signature" });
  if (statusCode !== "0000") { await pool.query("UPDATE payment_transactions SET status = 'FAILED' WHERE transaction_ref = ? AND status = 'PENDING'", [transactionId]); return res.status(400).json({ error: "Payment failed" }); }
  await settle(req.app, String(transactionId), "nagad_trx_id", String(transactionId));
  res.json({ success: true, message: "Payment successful" });
});

router.get("/history", verifyToken, async (req, res) => {
  const [transactions] = await pool.query("SELECT id, order_id, payment_method, amount, status, transaction_ref, created_at FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", [req.user.id]);
  res.json({ transactions });
});

router.get("/:transactionId", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT id, order_id, payment_method, amount, status, created_at FROM payment_transactions WHERE transaction_ref = ? AND user_id = ?", [req.params.transactionId, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "Transaction not found" });
  res.json({ transaction: rows[0] });
});

module.exports = router;

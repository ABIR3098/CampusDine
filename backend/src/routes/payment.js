const express = require("express");
const axios = require("axios");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Payment configurations (stored in environment variables)
const BKASH_APP_KEY = process.env.BKASH_APP_KEY;
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET;
const BKASH_USERNAME = process.env.BKASH_USERNAME;
const BKASH_PASSWORD = process.env.BKASH_PASSWORD;

const NAGAD_MERCHANT_ID = process.env.NAGAD_MERCHANT_ID;
const NAGAD_MERCHANT_KEY = process.env.NAGAD_MERCHANT_KEY;

const PAYMENT_RECEIVING_NUMBER = process.env.PAYMENT_RECEIVING_NUMBER || "";
const APP_URL = process.env.APP_URL || "http://localhost:5000";
const TOPUP_LIMIT = Number(process.env.MAX_WALLET_TOPUP || 9999);

async function createWalletTopup(req, res, method) {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > TOPUP_LIMIT) return res.status(400).json({ error: `Top-up must be between 1 and ${TOPUP_LIMIT}` });
  const configured = method === "bkash"
    ? [BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD].every(Boolean)
    : [NAGAD_MERCHANT_ID, NAGAD_MERCHANT_KEY].every(Boolean);
  if (!configured) return res.status(503).json({ error: `${method} wallet top-up is unavailable: configure gateway credentials` });
  return res.status(501).json({ error: `${method} wallet top-up adapter is ready but requires live gateway credentials` });
}

router.post("/bkash/wallet-topup", authenticateToken, (req, res) => createWalletTopup(req, res, "bkash"));
router.post("/nagad/wallet-topup", authenticateToken, (req, res) => createWalletTopup(req, res, "nagad"));

// Initiate bKash payment
router.post("/bkash/initiate", authenticateToken, async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount <= 0 || !orderId) {
      return res.status(400).json({ error: "Invalid amount or order ID" });
    }
    if (![BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD].every(Boolean)) {
      return res.status(503).json({ error: "bKash payment is unavailable: configure BKASH credentials" });
    }

    // Get bKash token
    const tokenResponse = await axios.post(
      "https://checkout.sandbox.bkash.com/api/checkout/token/grant",
      {
        app_key: BKASH_APP_KEY,
        app_secret: BKASH_APP_SECRET,
      },
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const bkashToken = tokenResponse.data.id_token;

    // Create payment request
    const createPaymentResponse = await axios.post(
      "https://checkout.sandbox.bkash.com/api/checkout/payment/create",
      {
        mode: "0011",
        payerReference: `ORDER_${orderId}`,
        callbackURL: `${APP_URL}/api/payment/bkash/callback`,
        amount: amount.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: `INV_${orderId}_${Date.now()}`,
      },
      {
        headers: {
          Authorization: `Bearer ${bkashToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const db = await getConnection();
    await db.query(
      `INSERT INTO payment_transactions 
       (user_id, order_id, payment_method, amount, status, transaction_ref) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        orderId,
        "bkash",
        amount,
        "PENDING",
        createPaymentResponse.data.paymentID,
      ]
    );
    db.release();

    res.json({
      success: true,
      paymentID: createPaymentResponse.data.paymentID,
      redirectUrl: createPaymentResponse.data.bkashURL,
    });
  } catch (error) {
    console.error("Error initiating bKash payment:", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// bKash payment callback
router.post("/bkash/callback", async (req, res) => {
  try {
    if (![BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD].every(Boolean)) return res.status(503).json({ error: "bKash payment is unavailable: configure BKASH credentials" });
    const { paymentID, status } = req.body;

    if (status !== "success") {
      return res.status(400).json({ error: "Payment failed" });
    }

    // Get bKash token for verification
    const tokenResponse = await axios.post(
      "https://checkout.sandbox.bkash.com/api/checkout/token/grant",
      {
        app_key: BKASH_APP_KEY,
        app_secret: BKASH_APP_SECRET,
      }
    );

    const bkashToken = tokenResponse.data.id_token;

    // Execute payment
    const executeResponse = await axios.post(
      "https://checkout.sandbox.bkash.com/api/checkout/payment/execute",
      { paymentID },
      {
        headers: { Authorization: `Bearer ${bkashToken}` },
      }
    );

    if (executeResponse.data.statusCode === "0000") {
      const db = await getConnection();

      // Update payment transaction
      await db.query(
        `UPDATE payment_transactions 
         SET status = ?, bkash_trx_id = ?
         WHERE transaction_ref = ?`,
        [
          "SUCCESS",
          executeResponse.data.trxID,
          paymentID,
        ]
      );

      // Get order details
      const [transaction] = await db.query(
        "SELECT order_id, user_id, amount FROM payment_transactions WHERE transaction_ref = ?",
        [paymentID]
      );

      if (transaction.length > 0) {
        // Update order status
        await db.query(
          "UPDATE orders SET status = 'Confirmed' WHERE id = ?",
          [transaction[0].order_id]
        );

        // Log wallet transaction
        await db.query(
          "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
          [
            transaction[0].user_id,
            -transaction[0].amount,
            `Order Payment via bKash - TRX: ${executeResponse.data.trxID}`,
          ]
        );
      }

      db.release();
      res.json({ success: true, message: "Payment successful" });
    } else {
      res.status(400).json({ error: "Payment execution failed" });
    }
  } catch (error) {
    console.error("Error processing bKash callback:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// Initiate Nagad payment
router.post("/nagad/initiate", authenticateToken, async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount <= 0 || !orderId) {
      return res.status(400).json({ error: "Invalid amount or order ID" });
    }
    if (![NAGAD_MERCHANT_ID, NAGAD_MERCHANT_KEY].every(Boolean)) {
      return res.status(503).json({ error: "Nagad payment is unavailable: configure NAGAD credentials" });
    }

    const uniqueId = `${orderId}_${Date.now()}`;

    const paymentPayload = {
      merchantId: NAGAD_MERCHANT_ID,
      orderId: uniqueId,
      amount: Math.round(amount * 100), // Convert to cents
      currencyCode: "050", // BDT
      description: `CampusDine Order #${orderId}`,
      orderDateTime: new Date().toISOString(),
      invoiceNumber: `INV_${orderId}`,
      sensitiveData: "",
      merchantAssignedOrderId: `ORDER_${orderId}`,
      callbackURL: `${APP_URL}/api/payment/nagad/callback`,
    };

    // Note: In production, you would sign this payload with Nagad's key
    // For now, we'll store the pending transaction

    const db = await getConnection();
    await db.query(
      `INSERT INTO payment_transactions 
       (user_id, order_id, payment_method, amount, status, transaction_ref) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        orderId,
        "nagad",
        amount,
        "PENDING",
        uniqueId,
      ]
    );
    db.release();

    // In production, send to Nagad's payment gateway
    const nagadPaymentUrl = `https://api.nagad.com.bd/api/v1/checkout/initialize`;

    res.json({
      success: true,
      transactionId: uniqueId,
      paymentUrl: nagadPaymentUrl,
      payload: paymentPayload,
      message: "Nagad payment initiated. Redirect to payment gateway.",
    });
  } catch (error) {
    console.error("Error initiating Nagad payment:", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// Nagad payment callback
router.post("/nagad/callback", async (req, res) => {
  try {
    if (![NAGAD_MERCHANT_ID, NAGAD_MERCHANT_KEY].every(Boolean)) return res.status(503).json({ error: "Nagad payment is unavailable: configure NAGAD credentials" });
    const { transactionId, status, statusCode } = req.body;

    if (statusCode !== "0000") {
      return res.status(400).json({ error: "Payment failed" });
    }

    const db = await getConnection();

    // Update payment transaction
    await db.query(
      `UPDATE payment_transactions 
      SET status = ?, nagad_trx_id = ?
       WHERE transaction_ref = ?`,
      [
        "SUCCESS",
        transactionId,
        transactionId,
      ]
    );

    // Get order details
    const [transaction] = await db.query(
      "SELECT order_id, user_id, amount FROM payment_transactions WHERE transaction_ref = ?",
      [transactionId]
    );

    if (transaction.length > 0) {
      // Update order status
      await db.query(
        "UPDATE orders SET status = 'Confirmed' WHERE id = ?",
        [transaction[0].order_id]
      );

      // Log wallet transaction
      await db.query(
        "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
        [
          transaction[0].user_id,
          -transaction[0].amount,
          `Order Payment via Nagad - TRX: ${transactionId}`,
        ]
      );
    }

    db.release();
    res.json({ success: true, message: "Payment successful" });
  } catch (error) {
    console.error("Error processing Nagad callback:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// Get payment history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [transactions] = await db.query(
      `SELECT id, order_id, payment_method, amount, status, 
              transaction_ref, created_at
       FROM payment_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    db.release();

    res.json({ transactions });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
});

// Get payment status
router.get("/:transactionId", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [transaction] = await db.query(
      `SELECT id, order_id, payment_method, amount, status, created_at
       FROM payment_transactions
       WHERE transaction_ref = ? AND user_id = ?`,
      [req.params.transactionId, req.user.id]
    );

    if (transaction.length === 0) {
      db.release();
      return res.status(404).json({ error: "Transaction not found" });
    }

    db.release();

    res.json({ transaction: transaction[0] });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

module.exports = router;

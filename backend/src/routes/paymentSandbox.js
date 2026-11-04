// CampusDine Route: Payment Sandbox API (bKash / Nagad / Rocket)
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const PaymentGatewayService = require("../services/paymentGatewayService");

// Initiate payment session
router.post("/initiate", verifyToken, (req, res) => {
  const { gateway, amount, orderId } = req.body;
  const gw = (gateway || "bkash").toLowerCase();

  return res.json({
    paymentId: "PAY-" + Date.now(),
    gateway: gw,
    amount: Number(amount || 0),
    orderId,
    gatewayInfo: PaymentGatewayService.SUPPORTED_GATEWAYS[gw] || PaymentGatewayService.SUPPORTED_GATEWAYS.bkash,
    message: "Payment session initialized. Please enter mobile number and OTP."
  });
});

// Execute sandbox payment
router.post("/execute", verifyToken, (req, res) => {
  try {
    const { gateway, mobileNumber, otp, amount, orderId } = req.body;

    if (!PaymentGatewayService.verifyOtp(otp)) {
      return res.status(400).json({ error: "Invalid OTP code. For demo, use 123456" });
    }

    const result = PaymentGatewayService.processPayment({
      gateway,
      mobileNumber,
      amount,
      orderId
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;

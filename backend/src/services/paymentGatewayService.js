// CampusDine Service: Multi-Gateway Mock Payment Sandbox (bKash, Nagad, Rocket, Upay)
const crypto = require("crypto");

const SUPPORTED_GATEWAYS = {
  bkash: { name: "bKash", color: "#e2136e", prefix: "BKS" },
  nagad: { name: "Nagad", color: "#f7941d", prefix: "NGD" },
  rocket: { name: "Rocket", color: "#8c3494", prefix: "RKT" },
  upay: { name: "Upay", color: "#005baa", prefix: "UPY" }
};

const PaymentGatewayService = {
  SUPPORTED_GATEWAYS,

  // Generate realistic Transaction ID
  generateTrxID(gateway = "bkash") {
    const gw = SUPPORTED_GATEWAYS[gateway.toLowerCase()] || SUPPORTED_GATEWAYS.bkash;
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const dateStamp = Date.now().toString().slice(-4);
    return `${gw.prefix}-${dateStamp}${randomHex}`;
  },

  // Validate mobile number format (Bangladeshi 01[3-9]XXXXXXXX)
  isValidMobileNumber(mobile) {
    if (!mobile || typeof mobile !== "string") return false;
    const clean = mobile.replace(/[\s-]/g, "");
    return /^(\+?8801|01)[3-9]\d{8}$/.test(clean);
  },

  // Simulate OTP verification (demo OTP: '123456' or any 6-digit number in sandbox mode)
  verifyOtp(otp, sandbox = true) {
    if (!otp) return false;
    if (sandbox) return /^\d{4,6}$/.test(otp);
    return otp === "123456";
  },

  // Process checkout payment transaction
  processPayment({ gateway, mobileNumber, amount, orderId }) {
    if (!PaymentGatewayService.isValidMobileNumber(mobileNumber)) {
      throw new Error("Invalid Bangladeshi mobile number format");
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const trxId = PaymentGatewayService.generateTrxID(gateway);
    return {
      success: true,
      trxId,
      gateway: (gateway || "bkash").toLowerCase(),
      amount: numAmount,
      orderId,
      timestamp: new Date().toISOString(),
      status: "COMPLETED"
    };
  }
};

module.exports = PaymentGatewayService;

const test = require("node:test");
const assert = require("node:assert/strict");
const PaymentGatewayService = require("../src/services/paymentGatewayService");

test("PaymentGatewayService.generateTrxID prefixes with correct gateway initials", () => {
  const bks = PaymentGatewayService.generateTrxID("bkash");
  const ngd = PaymentGatewayService.generateTrxID("nagad");
  const rkt = PaymentGatewayService.generateTrxID("rocket");
  assert.match(bks, /^BKS-/);
  assert.match(ngd, /^NGD-/);
  assert.match(rkt, /^RKT-/);
});

test("PaymentGatewayService.isValidMobileNumber validates Bangladeshi phone numbers", () => {
  assert.equal(PaymentGatewayService.isValidMobileNumber("01712345678"), true);
  assert.equal(PaymentGatewayService.isValidMobileNumber("+8801812345678"), true);
  assert.equal(PaymentGatewayService.isValidMobileNumber("01912-345678"), true);
  assert.equal(PaymentGatewayService.isValidMobileNumber("01212345678"), false); // Invalid operator prefix
  assert.equal(PaymentGatewayService.isValidMobileNumber("12345"), false);
});

test("PaymentGatewayService.verifyOtp validates 4-6 digit numeric OTP", () => {
  assert.equal(PaymentGatewayService.verifyOtp("123456"), true);
  assert.equal(PaymentGatewayService.verifyOtp("1234"), true);
  assert.equal(PaymentGatewayService.verifyOtp("abc"), false);
  assert.equal(PaymentGatewayService.verifyOtp(null), false);
});

test("PaymentGatewayService.processPayment completes transaction successfully", () => {
  const res = PaymentGatewayService.processPayment({
    gateway: "bkash",
    mobileNumber: "01712345678",
    amount: 150,
    orderId: 42
  });
  assert.equal(res.success, true);
  assert.equal(res.status, "COMPLETED");
  assert.match(res.trxId, /^BKS-/);
  assert.equal(res.amount, 150);
});

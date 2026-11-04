// CampusDine Service: POS Receipt Signature & ASCII Formatting
const crypto = require("crypto");

const ReceiptService = {
  // Generate tamper-evident cryptographic checksum for order slip
  generateReceiptSignature(token, total, timestamp) {
    const data = `${token}:${total}:${timestamp}:campusdine-sec-2026`;
    return crypto.createHash("sha256").update(data).digest("hex").slice(0, 12).toUpperCase();
  },

  // Format minimal 80mm printable POS text layout
  formatThermalAscii(order) {
    const sep = "--------------------------------";
    const lines = [
      "       CAMPUSDINE EXPRESS       ",
      "    BUP Central Cafeteria, Dhaka",
      sep,
      `TOKEN: ${order.token || "N/A"}`,
      `DATE : ${new Date(order.created_at || Date.now()).toLocaleString("en-BD")}`,
      sep
    ];

    (order.items || []).forEach((it) => {
      const name = (it.name || "").slice(0, 18).padEnd(18, " ");
      const qty = `${it.qty || 1}x`.padEnd(4, " ");
      const price = `Tk ${Number(it.price || 0) * (it.qty || 1)}`.padStart(8, " ");
      lines.push(`${qty}${name}${price}`);
    });

    lines.push(sep);
    lines.push(`TOTAL PAID: Tk ${order.total || order.total_amount || 0}`);
    lines.push(sep);
    lines.push("   THANK YOU FOR DINING WITH US ");

    return lines.join("\n");
  }
};

module.exports = ReceiptService;

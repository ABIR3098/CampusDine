// CampusDine Service: VendorSettlementService
// Manages multi-canteen revenue splitting, commission deductions, and automated payout settlements

class VendorSettlementService {
  static VENDORS = {
    "canteen-central": { name: "Central Canteen", commissionRate: 0.05, bankAccount: "DBBL-***4102" },
    "cafe-71": { name: "Cafe 71 Lounge", commissionRate: 0.07, bankAccount: "CITY-***8819" },
    "night-bakery": { name: "Campus Night Bakery", commissionRate: 0.04, bankAccount: "BKASH-01711***" },
    "juice-bar": { name: "Healthy Juice Corner", commissionRate: 0.05, bankAccount: "NAGAD-01922***" }
  };

  /**
   * Reconciles orders for a vendor and computes net payout
   * @param {string} vendorId
   * @param {Array<Object>} orders
   * @returns {Object} settlement statement
   */
  static reconcileVendorOrders(vendorId, orders = []) {
    const vendor = this.VENDORS[vendorId];
    if (!vendor) {
      throw new Error(`Unknown vendor ID: ${vendorId}`);
    }

    let grossSales = 0;
    let completedOrders = 0;

    orders.forEach(ord => {
      const isCompleted = (ord.status || "").toLowerCase() === "completed" || (ord.status || "").toLowerCase() === "delivered";
      if (isCompleted) {
        grossSales += Number(ord.total_amount || ord.total || 0);
        completedOrders++;
      }
    });

    const commissionAmount = Math.round(grossSales * vendor.commissionRate);
    const taxDeducted = Math.round(grossSales * 0.02); // 2% source withholding
    const netPayout = grossSales - commissionAmount - taxDeducted;

    return {
      settlementId: `SETTL-${Date.now().toString(36).toUpperCase()}-${vendorId.slice(0, 3).toUpperCase()}`,
      vendorId,
      vendorName: vendor.name,
      bankAccount: vendor.bankAccount,
      commissionRate: vendor.commissionRate,
      completedOrders,
      financials: {
        grossSales,
        commissionAmount,
        taxDeducted,
        netPayout: Math.max(0, netPayout)
      },
      status: "CALCULATED",
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Disburses payout and marks settlement as DISBURSED
   * @param {Object} settlementStatement
   * @param {string} trxReference
   * @returns {Object} updated statement
   */
  static disbursePayout(settlementStatement, trxReference) {
    if (!settlementStatement || settlementStatement.status !== "CALCULATED") {
      throw new Error("Invalid settlement statement or already disbursed");
    }

    return {
      ...settlementStatement,
      status: "DISBURSED",
      disbursementReference: trxReference || `BANK-TRX-${Date.now()}`,
      disbursedAt: new Date().toISOString()
    };
  }
}

module.exports = VendorSettlementService;

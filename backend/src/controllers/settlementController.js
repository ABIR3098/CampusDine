// CampusDine Controller: settlementController
const VendorSettlementService = require("../services/vendorSettlementService");

const settlementController = {
  getOverview: (req, res) => {
    // Generate simulated reconciliation for all vendors
    const mockOrdersMap = {
      "canteen-central": [{ total: 18500, status: "completed" }, { total: 12000, status: "delivered" }],
      "cafe-71": [{ total: 9400, status: "completed" }],
      "night-bakery": [{ total: 6800, status: "completed" }],
      "juice-bar": [{ total: 3200, status: "completed" }]
    };

    const vendorSummaries = Object.keys(VendorSettlementService.VENDORS).map(vId => {
      return VendorSettlementService.reconcileVendorOrders(vId, mockOrdersMap[vId] || []);
    });

    const totalGross = vendorSummaries.reduce((sum, v) => sum + v.financials.grossSales, 0);
    const totalCommission = vendorSummaries.reduce((sum, v) => sum + v.financials.commissionAmount, 0);
    const totalNetPayout = vendorSummaries.reduce((sum, v) => sum + v.financials.netPayout, 0);

    return res.json({
      totalGross,
      totalCommission,
      totalNetPayout,
      vendorSummaries
    });
  },

  reconcileVendor: (req, res) => {
    try {
      const { vendorId } = req.params;
      const orders = req.body.orders || [{ total: 5000, status: "completed" }];
      const statement = VendorSettlementService.reconcileVendorOrders(vendorId, orders);
      return res.json(statement);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  disburse: (req, res) => {
    try {
      const { statement, trxReference } = req.body;
      const result = VendorSettlementService.disbursePayout(statement, trxReference);
      return res.json({ success: true, settlement: result });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
};

module.exports = settlementController;

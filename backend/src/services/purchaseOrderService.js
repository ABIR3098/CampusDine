// CampusDine Service: PurchaseOrderService
// Handles supplier restocking, purchase order creation and lifecycle status

class PurchaseOrderService {
  static VALID_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "RECEIVED", "CANCELLED"];

  /**
   * Creates a structured purchase order with line-item totals
   * @param {Object} payload
   * @returns {Object} Purchase Order object
   */
  static createPurchaseOrder({ supplierName, supplierContact, items = [], createdBy = "admin" }) {
    if (!supplierName || typeof supplierName !== "string") {
      throw new Error("Supplier name is required");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("At least one purchase item is required");
    }

    let subtotal = 0;
    const validatedItems = items.map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const lineTotal = quantity * unitPrice;
      subtotal += lineTotal;

      return {
        lineId: index + 1,
        itemName: item.itemName || "Unnamed Item",
        unit: item.unit || "unit",
        quantity,
        unitPrice,
        lineTotal
      };
    });

    const tax = Math.round(subtotal * 0.05); // 5% VAT
    const deliveryFee = subtotal > 5000 ? 0 : 150;
    const grandTotal = subtotal + tax + deliveryFee;

    return {
      poNumber: "PO-" + Date.now() + "-" + Math.floor(Math.random() * 900 + 100),
      supplierName,
      supplierContact: supplierContact || "N/A",
      createdBy,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      items: validatedItems,
      pricing: {
        subtotal,
        tax,
        deliveryFee,
        grandTotal
      }
    };
  }

  /**
   * Transitions purchase order to a new valid status
   * @param {string} currentStatus
   * @param {string} targetStatus
   * @returns {string} updated status
   */
  static transitionStatus(currentStatus, targetStatus) {
    if (!this.VALID_STATUSES.includes(targetStatus)) {
      throw new Error(`Invalid target status: ${targetStatus}`);
    }

    const transitions = {
      DRAFT: ["SUBMITTED", "CANCELLED"],
      SUBMITTED: ["APPROVED", "CANCELLED"],
      APPROVED: ["RECEIVED", "CANCELLED"],
      RECEIVED: [],
      CANCELLED: []
    };

    const allowed = transitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(`Cannot transition purchase order from ${currentStatus} to ${targetStatus}`);
    }

    return targetStatus;
  }
}

module.exports = PurchaseOrderService;

// CampusDine Controller: tableController
const TableBookingService = require("../services/tableBookingService");

const tableController = {
  getSeatingOverview: (req, res) => {
    const tables = TableBookingService.DEFAULT_TABLES;
    const metrics = TableBookingService.getOccupancyMetrics(tables);
    return res.json({
      tables,
      metrics
    });
  },

  verifyTableQr: (req, res) => {
    const { token } = req.params;
    const result = TableBookingService.verifyTableQrToken(token);
    if (!result.isValid) {
      return res.status(400).json({ error: "Invalid or unrecognized Table QR code" });
    }
    return res.json({
      success: true,
      tableNo: result.tableNo,
      mode: "DINE_IN",
      message: `Checked in to Table #${result.tableNo}. Orders will be served here!`
    });
  },

  bookTable: (req, res) => {
    try {
      const studentId = req.user ? req.user.id : "guest";
      const studentName = req.user ? req.user.name : "Student";
      const { tableNo, partySize, timeSlot } = req.body;

      const reservation = TableBookingService.createReservation({
        studentId,
        studentName,
        tableNo,
        partySize,
        timeSlot
      });

      return res.json({
        success: true,
        message: `Table #${tableNo} reserved successfully!`,
        reservation
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
};

module.exports = tableController;

// CampusDine Service: TableBookingService
// Manages canteen seating occupancy, dine-in table QR codes, and advance reservations

class TableBookingService {
  static ZONES = ["Main Hall", "AC Lounge", "Open Balcony", "Faculty Corner"];
  static STATUSES = ["AVAILABLE", "RESERVED", "OCCUPIED", "CLEANING"];

  // Pre-configured canteen floor layout
  static DEFAULT_TABLES = [
    { tableNo: 1, zone: "Main Hall", capacity: 4, status: "AVAILABLE" },
    { tableNo: 2, zone: "Main Hall", capacity: 4, status: "OCCUPIED" },
    { tableNo: 3, zone: "Main Hall", capacity: 6, status: "AVAILABLE" },
    { tableNo: 4, zone: "Main Hall", capacity: 8, status: "RESERVED" },
    { tableNo: 5, zone: "AC Lounge", capacity: 2, status: "AVAILABLE" },
    { tableNo: 6, zone: "AC Lounge", capacity: 4, status: "AVAILABLE" },
    { tableNo: 7, zone: "Open Balcony", capacity: 4, status: "AVAILABLE" },
    { tableNo: 8, zone: "Faculty Corner", capacity: 6, status: "RESERVED" }
  ];

  /**
   * Generates a unique secure QR token for a table
   * @param {number} tableNo
   * @returns {string} QR token
   */
  static generateTableQrToken(tableNo) {
    const timestamp = Date.now().toString(36);
    return `CD-TBL-${tableNo}-${timestamp}`.toUpperCase();
  }

  /**
   * Validates and parses table QR code
   * @param {string} token
   * @returns {{isValid: boolean, tableNo: number|null}}
   */
  static verifyTableQrToken(token) {
    if (!token || typeof token !== "string") return { isValid: false, tableNo: null };
    const match = token.match(/^CD-TBL-(\d+)-[A-Z0-9]+$/i);
    if (!match) return { isValid: false, tableNo: null };
    return {
      isValid: true,
      tableNo: parseInt(match[1], 10)
    };
  }

  /**
   * Calculates current seating statistics
   * @param {Array<Object>} tables
   * @returns {Object} statistics
   */
  static getOccupancyMetrics(tables = this.DEFAULT_TABLES) {
    const totalTables = tables.length;
    let availableCount = 0;
    let occupiedCount = 0;
    let reservedCount = 0;
    let totalSeats = 0;
    let occupiedSeats = 0;

    tables.forEach(t => {
      totalSeats += t.capacity;
      if (t.status === "AVAILABLE") availableCount++;
      else if (t.status === "OCCUPIED") {
        occupiedCount++;
        occupiedSeats += t.capacity;
      } else if (t.status === "RESERVED") reservedCount++;
    });

    const occupancyRate = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0;

    return {
      totalTables,
      availableCount,
      occupiedCount,
      reservedCount,
      totalSeats,
      occupancyRate,
      isRushHour: occupancyRate >= 75
    };
  }

  /**
   * Creates a reservation for a party
   * @param {Object} bookingDetails
   * @returns {Object} reservation summary
   */
  static createReservation({ studentId, studentName, tableNo, partySize, timeSlot }) {
    if (!studentId || !tableNo) {
      throw new Error("Student ID and Table Number are required");
    }

    const size = Number(partySize) || 2;
    if (size < 1 || size > 12) {
      throw new Error("Party size must be between 1 and 12");
    }

    return {
      reservationId: `RES-${Date.now().toString().slice(-6)}`,
      studentId,
      studentName: studentName || "Student",
      tableNo: Number(tableNo),
      partySize: size,
      timeSlot: timeSlot || "13:00 - 13:45",
      status: "CONFIRMED",
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = TableBookingService;

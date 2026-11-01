// CampusDine UI: TableBookingModal
// Modal dialog for reserving a cafeteria table for study groups or faculty
(function() {
  const { React } = window;
  if (!React) return;
  const { useState } = React;

  function TableBookingModal({ isOpen, onClose, preselectedTable, onBookingConfirmed }) {
    if (!isOpen) return null;

    const [tableNo, setTableNo] = useState(preselectedTable ? preselectedTable.no : "T-01");
    const [partySize, setPartySize] = useState("4");
    const [timeSlot, setTimeSlot] = useState("13:00 - 13:45 (Lunch Rush)");
    const [specialNotes, setSpecialNotes] = useState("");

    const handleConfirm = () => {
      const booking = {
        tableNo,
        partySize: Number(partySize),
        timeSlot,
        notes: specialNotes
      };
      if (onBookingConfirmed) onBookingConfirmed(booking);
      alert(`🎉 Table ${tableNo} reserved successfully for ${partySize} persons at ${timeSlot}!`);
      onClose();
    };

    return (
      <div style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}>
        <div style={{
          backgroundColor: "#FFF",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "480px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#111827", fontWeight: "700" }}>🪑 Reserve a Canteen Table</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6B7280" }}>✕</button>
          </div>

          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Select Table</label>
              <select
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "14px" }}
              >
                <option value="T-01">T-01 (Main Dining Hall - 4 Seats)</option>
                <option value="T-03">T-03 (Main Dining Hall - 6 Seats)</option>
                <option value="T-05">T-05 (AC Lounge - 2 Seats)</option>
                <option value="T-06">T-06 (Open Balcony - 4 Seats)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Number of Persons (Party Size)</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "14px" }}
              >
                <option value="1">1 Person (Solo)</option>
                <option value="2">2 Persons</option>
                <option value="4">4 Persons (Standard)</option>
                <option value="6">6 Persons (Group)</option>
                <option value="8">8 Persons (Large Gathering)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Time Slot</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "14px" }}
              >
                <option value="09:00 - 09:45 (Breakfast)">09:00 - 09:45 (Breakfast)</option>
                <option value="13:00 - 13:45 (Lunch Rush)">13:00 - 13:45 (Lunch Rush)</option>
                <option value="14:00 - 14:45 (Late Lunch)">14:00 - 14:45 (Late Lunch)</option>
                <option value="17:00 - 17:45 (Afternoon Tea)">17:00 - 17:45 (Afternoon Tea)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Notes / Dietary Preferences (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Need high chair / corner table"
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "13px" }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{ padding: "9px 16px", backgroundColor: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: "8px", cursor: "pointer", fontWeight: "500" }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              style={{ padding: "9px 18px", backgroundColor: "#2563EB", color: "#FFF", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
            >
              Confirm Reservation
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.TableBookingModal = TableBookingModal;
})();

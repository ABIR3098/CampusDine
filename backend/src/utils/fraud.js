async function recordFraudEvent(db, { userId = null, eventType, severity = "MEDIUM", details, ipAddress = null }) {
  try {
    await db.query(
      "INSERT INTO fraud_events (user_id, event_type, severity, details_json, ip_address) VALUES (?, ?, ?, ?, ?)",
      [userId, eventType, severity, JSON.stringify(details || {}), ipAddress]
    );
  } catch (error) {
    console.error(`Failed to record fraud event ${eventType}:`, error);
  }
}

module.exports = { recordFraudEvent };

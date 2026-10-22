async function recordAuditEvent(connection, req, action, entityType, entityId, details = {}) {
  const serializedDetails = JSON.stringify(details);
  const safeDetails = serializedDetails.length <= 6000
    ? serializedDetails
    : JSON.stringify({ truncated: true });
  const ipAddress = String((req && req.socket && req.socket.remoteAddress) || "").slice(0, 64);

  await connection.query(`
    INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, details_json, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id,
    req.user.role,
    action,
    entityType,
    entityId == null ? null : String(entityId),
    safeDetails,
    ipAddress,
  ]);
}

module.exports = { recordAuditEvent };

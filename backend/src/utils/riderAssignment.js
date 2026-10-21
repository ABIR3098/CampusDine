async function assignOrderToBestRider(connection, orderId) {
  await connection.query(`
    SELECT rider_id FROM rider_shifts
    WHERE status = 'ON_DUTY'
    ORDER BY rider_id
    FOR UPDATE
  `);
  const [riders] = await connection.query(`
    SELECT u.id AS rider_id, COUNT(o.id) AS active_orders
    FROM users u
    JOIN rider_locations location ON location.rider_id = u.id
    JOIN rider_shifts shift ON shift.rider_id = u.id AND shift.status = 'ON_DUTY'
    LEFT JOIN orders o ON o.rider_id = u.id
      AND o.rider_assignment_status IN ('Assigned', 'Accepted') AND o.status <> 'Cancelled'
    WHERE u.role = 'rider' AND location.active = 1
      AND location.latitude IS NOT NULL AND location.longitude IS NOT NULL
      AND location.updated_at >= NOW() - INTERVAL 90 SECOND
    GROUP BY u.id, shift.max_orders, location.updated_at
    HAVING COUNT(o.id) < shift.max_orders
    ORDER BY active_orders ASC, location.updated_at DESC, u.id ASC
    LIMIT 1 FOR UPDATE
  `);
  if (!riders.length) return null;

  const riderId = Number(riders[0].rider_id);
  const [result] = await connection.query(`
    UPDATE orders SET rider_id = ?, rider_assignment_status = 'Assigned'
    WHERE id = ? AND rider_id IS NULL AND rider_assignment_status = 'Unassigned'
  `, [riderId, orderId]);
  return result.affectedRows === 1 ? riderId : null;
}

module.exports = { assignOrderToBestRider };

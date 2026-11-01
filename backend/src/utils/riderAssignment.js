// A rider only gets an order while on duty AND sharing a position that is at most this old.
// The rider app sends its position about every 8 seconds, so 90 seconds allows a few missed sends.
const LOCATION_FRESH_SECONDS = 90;

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
      AND location.updated_at >= NOW() - INTERVAL ${LOCATION_FRESH_SECONDS} SECOND
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

// Teacher orders that got no rider when they were placed (nobody on duty, or nobody sharing a
// position yet) stay 'Unassigned'. This hands them to a rider as soon as one is free.
// options.limit      how many waiting orders to try (default 100, oldest first)
// options.onAssigned called with { orderId, riderId } inside the transaction, before commit
// Returns the list of { orderId, riderId } that were assigned.
async function assignPendingTeacherOrders(pool, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100;
  const assigned = [];
  const connection = await pool.getConnection();
  try {
    const [pending] = await connection.query(`
      SELECT o.id
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.rider_id IS NULL AND o.rider_assignment_status = 'Unassigned'
        AND u.role = 'teacher' AND o.status IN ('Received', 'Cooking', 'Ready')
        AND o.picked_up_at IS NULL
      ORDER BY o.created_at ASC LIMIT ?
    `, [limit]);
    for (const order of pending) {
      const orderId = Number(order.id);
      await connection.beginTransaction();
      try {
        const riderId = await assignOrderToBestRider(connection, orderId);
        if (riderId && typeof options.onAssigned === "function") {
          await options.onAssigned({ orderId, riderId }, connection);
        }
        await connection.commit();
        // No free rider means the next order would find none either.
        if (!riderId) break;
        assigned.push({ orderId, riderId });
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    connection.release();
  }
  return assigned;
}

module.exports = { assignOrderToBestRider, assignPendingTeacherOrders, LOCATION_FRESH_SECONDS };

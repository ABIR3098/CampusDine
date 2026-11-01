// A rider accepts an order that was assigned to them.
// Pressing the button twice (or a slow network that sends it twice) is not an error:
// an order the same rider already accepted answers ok with changed = false.
// Returns { ok, changed, order } where order has user_id and token, or { ok: false }.
async function acceptAssignedOrder(pool, { orderId, riderId }) {
  const [result] = await pool.query(`
    UPDATE orders SET rider_assignment_status = 'Accepted'
    WHERE id = ? AND rider_id = ? AND rider_assignment_status = 'Assigned' AND status <> 'Cancelled'
  `, [orderId, riderId]);
  const [[order]] = await pool.query(
    "SELECT user_id, token, status, rider_assignment_status FROM orders WHERE id = ? AND rider_id = ? LIMIT 1",
    [orderId, riderId]
  );
  if (result.affectedRows) return { ok: true, changed: true, order };
  if (order && order.rider_assignment_status === "Accepted" && order.status !== "Cancelled") {
    return { ok: true, changed: false, order };
  }
  return { ok: false };
}

module.exports = { acceptAssignedOrder };

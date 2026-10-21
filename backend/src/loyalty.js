// Loyalty points + daily-order streak.
//
//  • Points are EARNED when an order becomes "Ready" (so a cancelled order can never keep points):
//    1 point per ৳<earnPer> of the amount actually paid.
//  • STREAK = consecutive calendar days (canteen time) with at least one order that reached Ready.
//    Every <streakDays>th day in a row pays a bonus (default: 5 days → +50 points).
//  • Points are SPENT at checkout on a reward (e.g. 100 points → ৳20 off, or a free item).
//    A cancelled order gives the spent points back.
//
// Every movement is a row in loyalty_ledger; loyalty_accounts holds the running balance + streak state.
const { localParts, dayDiff } = require("./utils/clock");

const DEFAULT_SETTINGS = { earnPer: 10, streakDays: 5, streakBonus: 50 };
const SETTING_KEYS = {
  earnPer: "loyalty_earn_per",
  streakDays: "loyalty_streak_days",
  streakBonus: "loyalty_streak_bonus",
};

async function getSettings(db) {
  const settings = { ...DEFAULT_SETTINGS };
  try {
    const [rows] = await db.query("SELECT meta_key, meta_value FROM app_meta WHERE meta_key LIKE 'loyalty\\_%'");
    for (const [name, key] of Object.entries(SETTING_KEYS)) {
      const row = rows.find((r) => r.meta_key === key);
      const value = row ? Number(row.meta_value) : NaN;
      if (Number.isInteger(value) && value >= 0) settings[name] = value;
    }
  } catch (e) { /* app_meta missing → defaults */ }
  if (settings.earnPer < 1) settings.earnPer = DEFAULT_SETTINGS.earnPer;
  if (settings.streakDays < 2) settings.streakDays = DEFAULT_SETTINGS.streakDays;
  return settings;
}

async function saveSettings(db, settings) {
  for (const [name, key] of Object.entries(SETTING_KEYS)) {
    if (settings[name] === undefined) continue;
    await db.query(
      "INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)",
      [key, String(settings[name])]
    );
  }
}

// Returns the user's account row, creating it on first use. lock = true → SELECT … FOR UPDATE (inside a transaction).
async function getAccount(db, userId, { lock = false } = {}) {
  await db.query("INSERT IGNORE INTO loyalty_accounts (user_id) VALUES (?)", [userId]);
  const [[row]] = await db.query(
    `SELECT user_id, points, lifetime_points, streak, best_streak, last_order_date FROM loyalty_accounts WHERE user_id = ?${lock ? " FOR UPDATE" : ""}`,
    [userId]
  );
  // DATE columns can come back as Date objects; keep a plain "YYYY-MM-DD" string
  if (row.last_order_date instanceof Date) {
    const d = row.last_order_date;
    row.last_order_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } else if (row.last_order_date) {
    row.last_order_date = String(row.last_order_date).slice(0, 10);
  }
  return row;
}

async function addLedger(db, { userId, kind, points, balanceAfter, label, orderId = null }) {
  await db.query(
    "INSERT INTO loyalty_ledger (user_id, kind, points, balance_after, label, order_id) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, kind, points, balanceAfter, label, orderId]
  );
}

// Called after an order is set to Ready. Safe to call twice (orders.loyalty_awarded_at is the guard).
// Manages its own transaction on a pooled connection. → { points, bonus, streak, balance } or null (nothing to do)
async function awardForOrder(pool, orderId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!order || order.status !== "Ready" || order.loyalty_awarded_at) {
      await conn.rollback();
      return null;
    }

    const settings = await getSettings(conn);
    const account = await getAccount(conn, order.user_id, { lock: true });
    const earned = Math.floor(Number(order.total) / settings.earnPer);

    // Streak, judged on the day the order was PLACED (canteen time)
    const orderDay = localParts(order.created_at).dateKey;
    let streak = account.streak;
    let last = account.last_order_date;
    let bonus = 0;
    if (!last) {
      streak = 1; last = orderDay;
    } else {
      const diff = dayDiff(last, orderDay);
      if (diff === 0) { /* second order on the same day — streak unchanged */ }
      else if (diff === 1) { streak += 1; last = orderDay; }
      else if (diff > 1) { streak = 1; last = orderDay; }
      // diff < 0: an older order finished late — it earns points but must not rewind the streak
      if (diff >= 1 && streak % settings.streakDays === 0) bonus = settings.streakBonus;
    }

    let balance = account.points;
    if (earned > 0) {
      balance += earned;
      await addLedger(conn, { userId: order.user_id, kind: "EARN", points: earned, balanceAfter: balance, label: `Order ${order.token}`, orderId: order.id });
    }
    if (bonus > 0) {
      balance += bonus;
      await addLedger(conn, { userId: order.user_id, kind: "STREAK_BONUS", points: bonus, balanceAfter: balance, label: `${streak}-day streak bonus`, orderId: order.id });
    }

    await conn.query(
      `UPDATE loyalty_accounts
       SET points = ?, lifetime_points = lifetime_points + ?, streak = ?, best_streak = GREATEST(best_streak, ?), last_order_date = ?
       WHERE user_id = ?`,
      [balance, earned + bonus, streak, streak, last, order.user_id]
    );
    await conn.query("UPDATE orders SET loyalty_awarded_at = NOW() WHERE id = ?", [order.id]);
    await conn.commit();
    return { userId: order.user_id, token: order.token, points: earned, bonus, streak, balance };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Spend points on a reward as part of placing an order (caller's transaction; the account row must already be locked).
async function redeemForOrder(conn, { userId, reward, orderId, token }) {
  const account = await getAccount(conn, userId, { lock: true });
  const cost = Number(reward.points_cost);
  if (account.points < cost) throw { status: 409, message: "Not enough loyalty points" };
  const balance = account.points - cost;
  await conn.query("UPDATE loyalty_accounts SET points = ? WHERE user_id = ?", [balance, userId]);
  await addLedger(conn, { userId, kind: "REDEEM", points: -cost, balanceAfter: balance, label: `${reward.name} — Order ${token}`, orderId });
  return balance;
}

// Cancelling an order gives back the points it spent (caller's transaction).
async function refundForOrder(conn, order) {
  if (!order.points_used || order.points_used <= 0) return null;
  const [[already]] = await conn.query("SELECT id FROM loyalty_ledger WHERE order_id = ? AND kind = 'REFUND'", [order.id]);
  if (already) return null;
  const account = await getAccount(conn, order.user_id, { lock: true });
  const balance = account.points + Number(order.points_used);
  await conn.query("UPDATE loyalty_accounts SET points = ? WHERE user_id = ?", [balance, order.user_id]);
  await addLedger(conn, { userId: order.user_id, kind: "REFUND", points: Number(order.points_used), balanceAfter: balance, label: `Refund — Order ${order.token} cancelled`, orderId: order.id });
  return balance;
}

// Everything the "Rewards" screen needs.
async function summaryFor(db, userId, now = new Date()) {
  const settings = await getSettings(db);
  const account = await getAccount(db, userId);
  const today = localParts(now).dateKey;

  let current = 0;
  let orderedToday = false;
  if (account.last_order_date) {
    const diff = dayDiff(account.last_order_date, today);
    orderedToday = diff === 0;
    current = diff <= 1 ? account.streak : 0; // missed a whole day → streak is broken
  }
  const target = settings.streakDays;
  const intoCycle = current % target;
  const [[pending]] = await db.query(
    "SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status IN ('Received','Cooking','Ready') AND loyalty_awarded_at IS NULL",
    [userId]
  );

  const [rewards] = await db.query(
    `SELECT r.id, r.name, r.name_bn, r.type, r.points_cost, r.discount_value, r.item_id, m.name AS item_name
     FROM loyalty_rewards r LEFT JOIN menu_items m ON m.id = r.item_id
     WHERE r.is_active = 1 ORDER BY r.points_cost, r.id`
  );
  const [ledger] = await db.query(
    "SELECT id, kind, points, balance_after, label, order_id, created_at FROM loyalty_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 40",
    [userId]
  );

  return {
    points: account.points,
    lifetimePoints: account.lifetime_points,
    settings,
    streak: {
      current,
      best: account.best_streak,
      target,
      bonus: settings.streakBonus,
      orderedToday,
      cycleDays: current > 0 && intoCycle === 0 ? target : intoCycle, // filled dots in the current 5-day row
      daysToBonus: intoCycle === 0 ? target : target - intoCycle,
      pendingOrders: Number(pending.n),
    },
    rewards: rewards.map((r) => ({ ...r, affordable: account.points >= r.points_cost })),
    ledger,
  };
}

module.exports = {
  DEFAULT_SETTINGS, getSettings, saveSettings, getAccount,
  awardForOrder, redeemForOrder, refundForOrder, summaryFor,
};

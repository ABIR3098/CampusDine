// Referral codes: each student/teacher has a code; a friend who signs up with it and gets their first order
// collected earns both of them a wallet bonus.
const crypto = require("crypto");

const REFERRAL_BONUS = 20;            // taka, for each of the two people
const MAX_REWARDS_PER_REFERRER = 10;  // after 10 rewarded friends the referrer is not paid again (the friend still is)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I so codes are easy to read out

function randomCode() {
  return "CD" + [...crypto.randomBytes(5)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

// The user's own code; created the first time it is asked for.
async function ensureCode(pool, userId) {
  const [[u]] = await pool.query("SELECT referral_code FROM users WHERE id = ?", [userId]);
  if (u && u.referral_code) return u.referral_code;
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    try {
      const [r] = await pool.query("UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL", [code, userId]);
      if (r.affectedRows) return code;
      const [[again]] = await pool.query("SELECT referral_code FROM users WHERE id = ?", [userId]);
      return again.referral_code;
    } catch (e) {
      if (e.code !== "ER_DUP_ENTRY") throw e; // somebody already has this code: try another
    }
  }
  throw new Error("Could not create a referral code");
}

// Called inside the pickup transaction. Pays once, on the referred user's first collected order.
// A savepoint keeps a failure here from ever blocking the pickup itself.
async function rewardReferral(conn, userId) {
  await conn.query("SAVEPOINT referral_reward");
  try {
    const [[u]] = await conn.query("SELECT id, name, referred_by, referral_rewarded_at FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!u || !u.referred_by || u.referral_rewarded_at) { await conn.query("RELEASE SAVEPOINT referral_reward"); return null; }

    const [[cnt]] = await conn.query("SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_rewarded_at IS NOT NULL", [u.referred_by]);
    const referrerPaid = Number(cnt.n) < MAX_REWARDS_PER_REFERRER;

    await conn.query("UPDATE users SET referral_rewarded_at = NOW(), wallet_balance = wallet_balance + ? WHERE id = ?", [REFERRAL_BONUS, u.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)",
      [u.id, "Referral bonus — welcome gift from a friend's code", REFERRAL_BONUS]);
    if (referrerPaid) {
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [REFERRAL_BONUS, u.referred_by]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)",
        [u.referred_by, `Referral bonus — ${String(u.name).split(" ")[0]} placed their first order`, REFERRAL_BONUS]);
    }
    await conn.query("RELEASE SAVEPOINT referral_reward");
    return { userId: u.id, referrerId: u.referred_by, amount: REFERRAL_BONUS, referrerPaid };
  } catch (e) {
    await conn.query("ROLLBACK TO SAVEPOINT referral_reward").catch(() => {});
    console.error("Referral reward failed:", e.message);
    return null;
  }
}

module.exports = { ensureCode, rewardReferral, REFERRAL_BONUS, MAX_REWARDS_PER_REFERRER };

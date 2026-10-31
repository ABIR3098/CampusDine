// Wallet top-up daily cap. The payment itself is simulated, so this cap is the only thing
// that limits how much test money one account can add in a day.
const DEFAULT_DAILY_TOPUP_LIMIT = 20000; // taka

// WALLET_TOPUP_DAILY_LIMIT in .env overrides the default; a missing or invalid value falls back to it.
function dailyTopupLimit(env = process.env) {
  const value = Number(env.WALLET_TOPUP_DAILY_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_TOPUP_LIMIT;
}

// Works in whole paisa so 0.1 + 0.2 style errors cannot let one extra paisa through.
// → { ok, remaining } where remaining is what is still allowed today, in taka.
function checkDailyTopup({ toppedUpToday, amount, limit }) {
  const used = Math.round(Number(toppedUpToday || 0) * 100);
  const wanted = Math.round(Number(amount) * 100);
  const cap = Math.round(Number(limit) * 100);
  const remaining = Math.max(cap - used, 0);
  return { ok: wanted <= remaining, remaining: remaining / 100 };
}

module.exports = { DEFAULT_DAILY_TOPUP_LIMIT, dailyTopupLimit, checkDailyTopup };

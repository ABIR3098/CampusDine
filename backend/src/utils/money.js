// Small money helpers, so the wallet routes and the tests share one copy.

// Round to 2 decimals (taka and paisa). Stops float noise such as 0.3 - 0.1 = 0.19999999999999998.
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// true when an amount has at most 2 decimal places, e.g. 10, 10.5, 10.55 but not 10.555
const hasMoneyPrecision = (amount) => Math.round(amount * 100) / 100 === amount;

module.exports = { r2, hasMoneyPrecision };

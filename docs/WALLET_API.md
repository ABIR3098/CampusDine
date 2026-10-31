# Wallet API

All routes need `Authorization: Bearer <token>`. Base path: `/api/wallet`.

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/` | any | Balance and transaction history |
| POST | `/topup` | any | Add money. Body `{ "amount": 500, "method": "bkash" }` |
| GET | `/recipient?id=<external id>` | student/teacher | Look up a name before paying |
| POST | `/transfer` | student/teacher | Send money. Body `{ "toId", "amount", "note" }` |
| GET | `/referral` | student/teacher | My referral code and how it is doing |

## Top-up
- `method` is one of `bkash`, `nagad`, `dbbl`, `brac`, `city`, `islami`, `sonali`, `card`.
- At most ৳10,000 per top-up, with at most 2 decimal places.
- At most ৳20,000 added per day per account (`WALLET_TOPUP_DAILY_LIMIT` in `.env` changes it). Over the limit answers `400`.
- The payment is simulated. No real gateway is called.

## Transfer
- At most ৳2,000 per transfer and ৳5,000 sent per day.
- Both wallets are locked and updated in one database transaction.
- Errors: `400` bad input or limit, `402` not enough balance, `404` unknown ID.

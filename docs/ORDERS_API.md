# Orders API

All routes need `Authorization: Bearer <token>`. Base path: `/api/orders`.
Roles: **C** = student/teacher (customer), **A** = admin.

| Method | Path | Role | What it does |
|---|---|---|---|
| POST | `/` | C | Place an order |
| GET | `/config` | any | Ordering rules: tip options, cart limits, pickup window, avg minutes per order |
| GET | `/mine` | C | My orders. Optional `?status=&limit=&offset=`; total in `X-Total-Count` |
| GET | `/mine/stats` | C | My order count, spend, average order, favourite item |
| GET | `/:id` | C (own) / A | One order with items, queue and feedback |
| GET | `/` | A | Live queue. Optional `?restaurant=&status=&q=&from=&to=` |
| PATCH | `/:id/cancel` | C | Cancel a `Received` order. Optional body `{ "reason": "..." }` |
| PATCH | `/:id/advance` | A | Received → Cooking → Ready |
| POST | `/verify` | A | Check / collect a scanned QR token |
| POST | `/:id/feedback` | C | Rate an order |
| POST | `/:id/rate-rider` | C | Rate the rider |
| POST | `/:id/report` | C | Report a problem |

## Placing an order

`POST /api/orders`

```json
{ "items": [{ "id": 3, "qty": 2 }], "paymentMethod": "wallet",
  "note": "less spicy", "pickupTime": "13:30", "tip": 10 }
```

Limits (also served by `GET /config`): at most 20 of one item, 15 different items, tip one of 0/5/10/20.
One order can only hold items from a single restaurant.

## Queue estimate

Active ASAP orders carry `queue: { ahead, position, est_minutes, est_ready_at }`.
`est_ready_at` is an ISO timestamp.

## Filters

* `status` is one of `Received`, `Cooking`, `Ready`, `Cancelled` (case-insensitive).
* `limit` is 1–100, `offset` is 0 or more.
* `from` / `to` are `YYYY-MM-DD`, both days included.
* `q` searches the order token (e.g. `C-105`).

Bad values return `400` with `{ "error": "..." }`.

## Tests

`cd backend && npm test` runs the unit tests for the pure order rules (`src/utils/orderRules.js`, `src/utils/pickup.js`).

# Spending summary and budget API

Base path: `/api/summary`. For students and teachers. Only your own orders are counted, and cancelled orders are left out.

| Method and path | What it does |
|---|---|
| `GET /?year=2026&month=10` | Where my money went this month (defaults to the current month) |
| `GET /budget` | My monthly limit and how much I have spent this month |
| `PUT /budget` | Set or remove the limit. Body: `{ "limit": 3000 }` or `{ "limit": null }` |

## Rules
- A budget must be between ৳50 and ৳100,000, or `null` to remove it.

## Errors
400 invalid month, or a budget outside the allowed range.

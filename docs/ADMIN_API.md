# Admin API

Base path: `/api/admin`. Every route needs an admin login.

| Method and path | What it does |
|---|---|
| `GET /overview[?restaurant=id]` | Pending orders, revenue, low stock and meal-plan counts. With `restaurant` the order numbers cover only that restaurant |
| `GET /reports/revenue-trend` | The last 6 completed months |
| `GET /reports/forecast` | Meals expected tomorrow: the average of the last 4 same weekdays |
| `GET /reports/summary?from=&to=` | Report for a date range (default: last 30 days) |
| `GET /reports/export?type=orders\|hall&from=&to=` | The same range as a CSV download (default type is `orders`) |
| `GET /feedback` | Rating summary, rating breakdown and recent feedback (per-order and general) |
| `POST /announcement` | Send a live announcement to everyone. Body: `message` |

## Notes
- Dates are `YYYY-MM-DD` and both ends are included.
- A CSV cell that starts with `=`, `+`, `-` or `@` gets a leading quote so Excel does not run it as a formula.
- Low stock means 10 or fewer.
- An announcement is sent with the `announcement` socket event to every connected user and is not stored.

## Errors
400 unknown restaurant, bad date range, or an empty announcement.

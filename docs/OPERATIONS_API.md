# Operations API (rider shifts, assignment, analytics)

These routes are mounted under `/api` (for example `/api/riders/shift/start`).
Rider GPS and accepting deliveries are in [RIDERS_API.md](RIDERS_API.md).

## Rider shifts
| Method and path | Who | What it does |
|---|---|---|
| `GET /riders/shift/me` | rider | My current shift |
| `POST /riders/shift/start` | rider | Go on duty. Body: `maxOrders`, a whole number from 1 to 10 |
| `POST /riders/shift/end` | rider | Go off duty |
| `GET /riders/shifts` | teacher, admin | Who is on duty |
| `GET /riders/assignable-orders` | teacher, admin | Orders that still need a rider |
| `GET /riders/route` | rider | A suggested delivery order. Needs GPS sharing to be on (otherwise 409) |

## Assigning a rider
`POST /orders/:id/assign-rider` (teacher, admin). Body: `riderId`.

- Only teacher orders can be delivered by a rider (403 otherwise).
- 409 when the order is no longer available, the rider is not on duty, or the rider already has `maxOrders` active orders.
- The rider gets the `rider:order-assigned` event.

## Admin only
| Method and path | What it does |
|---|---|
| `GET /analytics` | Order count, revenue and cancelled orders, top items, orders per hour and deliveries per rider |
| `GET /fraud-events` | Events the server flagged (see `fraud_events`) |
| `GET /audit?limit=100` | The audit log, newest first |

## Errors
400 bad `maxOrders` or missing ids; 403 not a teacher order; 404 order not found; 409 see above.

# Riders API

All routes need `Authorization: Bearer <token>`. Base path: `/api/riders`.

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/orders` | rider | My orders that are `Assigned` or `Accepted`, with customer name, phone and address |
| GET | `/orders/summary` | rider | Counts by status, tips earned, average rating and my 5 latest reviews |
| POST | `/orders/:orderId/accept` | rider | Accept an order assigned to me (`409` if it is not mine or was cancelled) |
| POST | `/location` | rider | Share my position: `{ latitude, longitude, accuracy? }`, or `{ active: false }` to stop |
| GET | `/locations` | teacher | Every rider's latest position |
| POST | `/orders/assign-pending` | admin | Try again to assign teacher orders that have no rider (up to 100) |

## When an order gets a rider
- Only **teacher** orders use delivery riders. Student orders are collected at the counter.
- A rider is picked automatically when the order is placed, or by `assign-pending`.
- The rider must be on duty, have a shared location updated in the last 90 seconds, and have fewer active orders than their shift limit.
- Among those, the rider with the fewest active orders is chosen, then the one with the freshest location.
- If nobody qualifies, the order stays `Unassigned` until an admin runs `assign-pending`.

## Order lifecycle for a rider
`Assigned` → `Accepted` → `Completed`. The order becomes `Completed` when the counter scans its QR code at handover, and it then leaves the rider's list. A cancelled order also disappears from it.

## Location
- Latitude must be -90 to 90 and longitude -180 to 180, otherwise `400`.
- `GET /locations` shows a rider as active only if their last update is under 30 seconds old.
- Teachers also receive live updates over Socket.IO (`rider:location`).
- Only the rider's own device position is stored.

## Tips and ratings
`/orders/summary` adds up tips already paid out (`tips_total`, `tips_today`) and the rating average and count. Reviews do not show the student's name.

# Riders API

All routes need `Authorization: Bearer <token>`. Base path: `/api/riders`.

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/orders` | rider | My orders that are `Assigned` or `Accepted`, with customer name, phone and address |
| GET | `/orders/summary` | rider | Counts by status, `waiting_orders` (teacher orders with no rider yet, a number only), tips earned, average rating and my 5 latest reviews |
| POST | `/orders/:orderId/accept` | rider | Accept an order assigned to me (`409` if it is not mine or was cancelled). Accepting an order I already accepted answers `200` again. The teacher who ordered gets `order:rider-accepted` |
| POST | `/location` | rider | Share my position: `{ latitude, longitude, accuracy? }`, or `{ active: false }` to stop |
| GET | `/locations` | teacher | Every rider's latest position |
| POST | `/orders/assign-pending` | admin | Try again to assign teacher orders that have no rider (up to 100) |

## When an order gets a rider
- Only **teacher** orders use delivery riders. Student orders are collected at the counter.
- A rider is picked automatically when the order is placed. An order that finds nobody is tried again when a rider starts a shift, when a rider sends a position (at most every 5 seconds), every 20 seconds by a timer on the server (`RIDER_DISPATCH_SECONDS`), and by `assign-pending`.
- The rider must be on duty, have a shared location updated in the last 90 seconds, and have fewer active orders than their shift limit.
- Among those, the rider with the fewest active orders is chosen, then the one with the freshest location.
- If nobody qualifies, the order stays `Unassigned` and is offered again by the retries above, oldest order first. The assigned rider gets the `rider:order-assigned` event and the audit log shows `AUTO_RIDER_ASSIGN` (actor `system` when the timer did it).
- In the rider app, starting the duty shift also turns the GPS sharing on, and the app warns when the rider is on duty but the server has no recent position.

## Audit log
A rider accepting a delivery is written as `RIDER_ACCEPT` (order id, rider id); an automatic assignment is `AUTO_RIDER_ASSIGN`.

## Demo GPS
The rider app has a **Demo GPS** button next to Enable GPS. It saves a fixed campus position in the browser and sends it (with a tiny drift) about every 8 seconds through the normal `POST /location`, so a rider on a desktop browser, without HTTPS or without phone GPS can still be on duty and receive teacher orders. Stop GPS ends it. The server cannot tell demo positions from real ones.

## Order lifecycle for a rider
`Assigned` → `Accepted` → `Completed`. The order becomes `Completed` when the counter scans its QR code at handover, and it then leaves the rider's list. A cancelled order also disappears from it.

## Location
- Latitude must be -90 to 90 and longitude -180 to 180, otherwise `400`.
- `GET /locations` shows a rider as active only if their last update is under 30 seconds old.
- Teachers also receive live updates over Socket.IO (`rider:location`).
- Only the rider's own device position is stored.

## Tips and ratings
`/orders/summary` adds up tips already paid out (`tips_total`, `tips_today`) and the rating average and count. Reviews do not show the student's name.

## Locations for teachers
`GET /locations` lists every rider, but latitude, longitude, accuracy and time are filled in only while the rider is sharing (last update under 30 seconds ago). For every other rider those fields are `null` and `active` is `false`, so a teacher never sees where an off-duty rider last was.

## Chat with the canteen admin
Riders do not have their own chat routes. They use the support chat under `/api/chat` in the canteen inbox (see [CHAT_API.md](CHAT_API.md)): `GET /messages`, `POST /messages`, `GET /unread`, photos, reactions and presence. A rider's message always goes to the canteen admin; `scope=hall` is ignored. Order chat with the customer is separate (`/api/chat/order/:orderId/messages`).

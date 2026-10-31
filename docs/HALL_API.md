# Hall API (`/api/hall`)

The Hall module is the meal system for hall residents: switch meals on/off, book guests, take a
meal token, pay the monthly bill, plus admin reports. Code: `backend/src/hall/`
(router in `index.js`, one file per area in `routes/`). Related docs:
[HALL_MENU.md](HALL_MENU.md), [FEAST_RSVP_API.md](FEAST_RSVP_API.md).

## Who can call it

Every route needs a login token (`Authorization: Bearer <token>`) and one of these roles:
`student`, `teacher`, `admin` (the canteen admin). Other roles get `403`.

- A **student** must also have a Hall account (`account_type = hall`), otherwise `403`.
- `hall_admin` does **not** use this API; it has its own `/api/hall-admin` routes.
- "admin" below means `role = admin`. A user who is assigned to a university only sees that
  university's data.

Times follow the canteen clock (`CANTEEN_TZ`, default `Asia/Dhaka`). Dates are `YYYY-MM-DD`,
meals (slots) are `breakfast`, `lunch`, `dinner`.

## Limits

| Limit | Value | Where |
|---|---|---|
| Plan meals / guests ahead | 31 days | `meals.js`, `guests.js`, `range.js` |
| Days returned by `GET /meals` | 62 at most | `states.js` |
| "I'm away" range length | 31 days | `range.js` |
| Guests per meal | 0 to 5 | `guests.js` |
| Last-call plates per person | 2 | `lastcall.js` |
| Plates in one last call | 500 | `lastcall.js` |

A meal can only be changed **until its cut-off** (set per slot). After that the API answers
`409` ("closed").

## Meals

| Method and path | Who | What |
|---|---|---|
| `GET /info` | all | Who is asking and the canteen clock. |
| `GET /slots` | all | The three slots with cut-off time and prices. |
| `PUT /slots/:slot` | admin | Body `{ cutoffTime: "HH:MM", cutoffDaysBefore: 0-3, price, guestPrice }`. |
| `GET /meals?from=&to=` | all | Own meal states (default: today + 6 days). |
| `PUT /meals/:date/:slot` | student, teacher | Body `{ status: "on"\|"off", onlyThisDay? }`. By default the choice also applies to the following days. |
| `PUT /meals-range` | student, teacher | "I'm away". Body `{ from, to, status, slots? }`. Closed meals are skipped; the day after `to` keeps its old state. Returns `{ from, to, status, changed, skippedLocked }`. |
| `GET /menu` | all | The weekly menu. |
| `PUT /menu/:dow/:slot` | admin | Body `{ items: "Rice, Dal" }`. |
| `POST /auto-fill` | admin | Runs the cut-off job now (it also runs every minute). |

If a person never chose, the meal is **on** (`DEFAULT_STATE` in `states.js`).

## Guests, feasts and last call

| Method and path | Who | What |
|---|---|---|
| `GET /guests?from=&to=` | all | Own guest bookings (default: today + 6 days). |
| `PUT /guests/:date/:slot` | all | Body `{ count: 0-5, names?: [{ name, phone }] }`. `0` removes the booking. If `names` is left out, saved names are kept. |
| `GET /feasts?from=&to=` | all | Special meals (default: today + 60 days). |
| `POST /feasts` | admin | Body `{ date, slot, title, items, extraPrice }`. |
| `DELETE /feasts/:id` | admin | Remove a feast. |
| `POST /feasts/:id/rsvp`, `DELETE /feasts/:id/rsvp` | all | Answer going / not going, or take the answer back. See FEAST_RSVP_API.md. |
| `GET /feasts/:id/rsvps` | admin | Who answered what. |
| `GET /lastcall` | all | Today's leftover-plate offers. |
| `POST /lastcall/:id/claim` | all | Takes the price from the wallet (all or nothing). Returns `{ code, price, balance }`. |
| `GET /lastcall/manage` | admin | Today's and the last 7 days' last calls. |
| `POST /lastcall` | admin | Body `{ slot, plates, price, note?, notify? }`. |
| `PATCH /lastcall/:id/close` | admin | No more claims; plates already claimed stay valid. |
| `POST /lastcall/serve` | admin | Body `{ code }`. Marks a plate as collected. |
| `POST /lastcall/claims/:id/cancel` | admin | Cancels a plate that was not collected and refunds the money. |

## Tokens and the serving queue

| Method and path | Who | What |
|---|---|---|
| `GET /token` | all | Own tokens for today: `[{ slot, serial, plates, status, nowServing, ahead }]`. |
| `POST /token` | all | Body `{ slot, payMethod }`. Needs the meal ON (or guest plates). `"wallet"` pays that meal now; `"later"` (default) leaves it in the monthly bill. One token per meal (`409` if you already have one, `402` if the wallet is too low). |
| `GET /queue?slot=` | admin | Today's queue for that meal. |
| `POST /queue/scan` | admin | Body `{ code: "HALL\|YYYY-MM-DD\|slot\|serial" }`. Must be today's code; marks it served once. |
| `POST /queue/serve` | admin | Body `{ slot, serial }`. Marks a token served by hand. |

## Money

| Method and path | Who | What |
|---|---|---|
| `GET /bill?year=&month=` | student, teacher | The month's bill. Closed meals are "confirmed", open meals are an estimate. Also returns `paid`, `due`, `walletBalance`. |
| `POST /bill/pay` | student, teacher | Body `{ year, month }`. Pays everything due for closed meals from the wallet in one transaction. |
| `GET /autopay` | student, teacher | `{ enabled, graceDays, history }`. |
| `PUT /autopay` | student, teacher | Body `{ enabled }`. |
| `POST /autopay/run` | admin | Runs auto-pay now (ignores the 1st to 10th window). |
| `GET /defaulters` | admin | Who still owes money, with a summary. |
| `POST /defaulters/remind` | admin | Sends reminders: `{ sent, skipped }`. |
| `GET /finance/summary` | admin | Income, expenses, cost per plate, result. |
| `GET /finance/expenses?year=&month=` | admin | Expense list and categories. |
| `POST /finance/expenses` | admin | Body `{ date, category, amount, supplierId?, note? }`. |
| `DELETE /finance/expenses/:id` | admin | Remove a wrong entry. |

Auto-pay takes the **previous** month's bill between the 1st and the 10th. It retries each day
if the wallet is too low. The scheduler checks every 30 minutes.

## Ratings, diet and reports

| Method and path | Who | What |
|---|---|---|
| `GET /ratings/mine` | all | Closed meals that were ON for you, with your stars. |
| `PUT /ratings/:date/:slot` | all | Body `{ stars: 1-5, comment? }`. |
| `GET /ratings/summary?days=` | admin | Averages, distribution, lowest-rated meals (1 to 90 days, default 30). Comments have no names. |
| `GET /ratings/trend` | admin | Change between the first and second half of the period. |
| `GET /diet/mine`, `PUT /diet/mine` | all | Own avoid / allergy tags and note. |
| `GET /diet/menu`, `GET /diet/warnings` | all | The week's menu with tags; warnings only for meals that are ON. |
| `GET /diet/summary` | admin | How many people avoid or are allergic to each tag. |
| `GET /report/day`, `/report/guests`, `/report/range`, `/report/changes` | admin | Plate counts, guest lists and who changed a meal. `/report/range` covers at most 31 days. |

## Services, notices and inventory (`services.js`)

| Method and path | Who | What |
|---|---|---|
| `GET /services?type=` | all | A student sees own requests; admin sees all. |
| `POST /services` | all | Create a request (`maintenance`, `cleaning`, `laundry`, `complaint`, ...). Title 3 to 180 characters, description up to 5000. |
| `PATCH /services/:id` | admin | Change status. |
| `DELETE /services/:id` | owner or admin | Delete a request. |
| `GET /notices`, `POST /notices`, `DELETE /notices/:id` | read: all; write: admin | Hall notices. |
| `GET/POST /inventory`, `DELETE /inventory/:id` | admin | Kitchen stock. |
| `GET /students`, `PATCH /students/:id/room` | admin | Residents and room changes. |
| `GET /overview`, `GET /audit` | admin | Dashboard numbers and the audit log. |
| `GET /pickup-tokens`, `POST /pickup-tokens`, `PATCH /pickup-tokens/:code/serve` | read: all; create: student, teacher; serve: admin | Meal pickup token. It only proves collection; it never charges the wallet. |
| `GET/POST /waste`, `GET /forecast` | admin | Food waste log and demand estimate (simple average, not AI). |

Room, visitor, laundry, clearance and notification routes live in `hall/advanced.js`.

## Errors

Errors are `{ "error": "message" }` with these codes: `400` bad input, `402` wallet too low,
`403` wrong role or not a Hall account, `404` not found, `409` meal closed or already done.

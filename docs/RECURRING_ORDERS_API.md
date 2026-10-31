# Weekly orders API: `/api/recurring`

A weekly order is a **reminder**, not an automatic order. Nothing is ordered or charged for the person.
On the chosen days, at the chosen time, the app shows the saved items so they can be added to the cart.

Every route needs a login token and the role `student` or `teacher`. People only see and change their own plans.

## Routes

| Method and path | What it does |
|---|---|
| `GET /` | My plans, oldest first. Each is `{ id, items, days, time, active }`. `days` are numbers, 0 = Sunday to 6 = Saturday. |
| `GET /due` | Plans whose reminder is showing now: active, today is one of its days, the time has come but is at most 4 hours ago, and it was not marked done today. Each has `today` added. |
| `POST /` | Make a plan. Body `{ items: [{ id?, name?, qty }], days: [0-6], time: "HH:MM" }`. Answers `201` with the plan. |
| `PATCH /:id` | Pause or resume. Body `{ active: false }` pauses; anything else resumes. |
| `DELETE /:id` | Delete a plan. |
| `POST /:id/done` | Hide today's reminder (the items were added to the cart, or skipped). |

## Rules when making a plan

- At most **8 items** are read. Each is found by `id`, or by exact `name` when the id is missing or not on the menu. Hidden items are ignored.
- The same item twice is merged. Each quantity is 1 to 5 (a missing or bad quantity counts as 1).
- Days are cleaned: only whole numbers from 0 to 6, no repeats. At least one is needed.
- `time` must look like `07:30` (24 hours, `00:00` to `23:59`).
- A person can keep **5 plans**. The sixth is refused until one is deleted.

## Answers

| Status | When |
|---|---|
| `400` | No valid day; no valid time; none of the items are on the menu any more. |
| `404` | The plan does not exist or belongs to someone else (`PATCH`, `DELETE`, `done`). |
| `409` | Already 5 plans. |

## Good to know

- "Today" and "now" use the server's own clock, not the canteen clock used by the Hall module. If the server runs in another time zone, reminders appear at the wrong hour.
- A plan stays visible in `GET /due` for 4 hours (240 minutes) after its time.

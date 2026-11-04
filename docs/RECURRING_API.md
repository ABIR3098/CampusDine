# Weekly order reminders API

Base path: `/api/recurring`. For students and teachers. A plan only **reminds** you; nothing is ordered
or charged automatically.

| Method and path | What it does |
|---|---|
| `GET /` | My plans |
| `GET /due` | Plans whose reminder time has come today and that were not added or skipped yet |
| `POST /` | Make a plan |
| `PATCH /:id` | Pause or resume. Body: `{ "active": false }` pauses, anything else resumes |
| `DELETE /:id` | Delete a plan |
| `POST /:id/done` | Hide today's reminder (the items were added to the cart or skipped) |

## Make a plan
Body: `items` (a list of `{ id or name, qty }`, at most 8), `days` (numbers 0 to 6, Sunday is 0) and `time` (`HH:MM`, 24-hour).

## Rules
- At most 5 plans per person.
- A reminder stays on screen for 4 hours after its time.

## Errors
400 no day chosen, bad time, or none of the items is on the menu any more; 404 plan not found; 409 already 5 plans.

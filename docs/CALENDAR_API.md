# Meal calendar API

Base path: `/api/calendar`. For students and teachers. The month is a plan: each day is `off`, `full`
or `half`. Marked days are *due* until the month is paid from the wallet.

| Method and path | What it does |
|---|---|
| `GET /?year=2026&month=10` | The days of the month: `the_date`, `status`, `paid`. Month is 1 to 12 |
| `GET /bill?year=&month=` | Full days, half days, the rates, the total, what is paid and what is still due |
| `POST /pay` | Pay every unpaid full or half day of the month from the wallet. Body: `year`, `month` |
| `POST /repeat` | Copy last month's weekly pattern onto unmarked days from today on. Nothing is paid. Body: `year`, `month` |
| `PUT /:day` | Set one day. Body: `year`, `month`, `status` (`off`, `full` or `half`) |

## Rules
- Rates come from `meal_rates`, one row for students and one for teachers.
- A paid day in the future may still be changed and the money goes back to the wallet. Today and past paid days are locked.
- Paying needs enough wallet balance (otherwise 402).

## Errors
400 invalid month or date, no unpaid days, last month has nothing to copy; 402 not enough money;
409 the day is paid and locked.

# Campus Command Center API

All routes need `Authorization: Bearer <token>`. Base path: `/api/campus`.
Roles: **S** student, **T** teacher, **A** canteen admin, **H** hall admin.

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/queue` | S, T, A | Active order counts and estimated wait. Admin must pass `?restaurant=<id>` |
| GET | `/live-tracking` | T | My active delivery orders and the assigned rider's location |
| GET | `/recommendations` | S, T | Up to 8 items ranked by my past orders, campus popularity and stock |
| GET | `/lost-found` | S, T, H | Open and claimed posts. Only the hall admin sees the contact field |
| POST | `/lost-found` | S, T | New post. Optional PNG/JPG/WEBP image under 2 MB |
| PATCH | `/lost-found/:id` | H | Set status: `open`, `claimed`, `returned`, `closed` |
| POST | `/emergency` | S, T | Send an SOS. One active alert per 2 minutes |
| GET | `/emergency` | H | Emergency inbox |
| PATCH | `/emergency/:id` | H | Set status: `acknowledged`, `responding`, `resolved`, `false_alarm` |
| GET | `/waste-challenge` | all | 30-day totals, 7-day trend, leaderboard |
| POST | `/waste-challenge/join` | S, T | Join the challenge |
| POST | `/waste-challenge/pledge` | S, T | One no-waste pledge per day (`409` if repeated) |
| POST | `/waste-challenge` | A | Log cooked and leftover portions for a restaurant |

## Notes
- The queue wait estimate is 4 minutes per active order.
- Tables are created on first use. `backend/migrations/20261030_campus_command_center.sql` does the same by hand.
- The JSON body limit is 4 MB. Images are stored as base64 text in the database.

# General feedback API

Base path: `/api/feedback`. For students and teachers. This is feedback that is **not** tied to one order
(order ratings live in [ORDERS_API.md](ORDERS_API.md)).

| Method and path | What it does |
|---|---|
| `POST /` | Send feedback |
| `GET /mine` | My own feedback, newest first |

## Send feedback
Body: `rating` (whole number 1 to 5), `category` and an optional `comment` (up to 500 characters).
`category` is one of `food`, `service`, `hygiene`, `suggestion`, `other`; anything else is saved as `other`.
Admins are told live with the `feedback:new` event.

## Errors
400 rating is not a whole number from 1 to 5, or the comment is longer than 500 characters.

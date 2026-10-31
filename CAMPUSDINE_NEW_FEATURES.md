# CampusDine — Campus Command Center & Student Features

## Role access (no new role added)

- **Canteen Admin (`admin`)**: Canteen Command Center for the currently selected restaurant. Queue and food-waste records are scoped to that restaurant.
- **Hall Admin (`hall_admin`)**: Hall Command Center in `hall-admin.html`; can review and update emergency alerts and Lost & Found posts.
- **Student / Teacher**: Campus Hub with own live order tracking, queue overview, personalized recommendations, Lost & Found posting, Food Waste Challenge and SOS submission.

## Features added

1. **Smart Live Order Tracking** — teacher accounts with an assigned rider see order status, rider name, GPS freshness and a map link. Data refreshes every 15 seconds. Student order pages never show GPS.
2. **Smart Queue Management** — live counts for Received / Cooking / Ready and an estimated new-order wait. Students see campus-wide queue totals; Canteen Admin sees only the selected restaurant's queue. Existing per-order queue position remains in Track Order.
3. **Campus Food Waste Challenge** — students can join and record one no-waste pledge per day. Canteen Admin logs cooked and leftover portions per meal; the Command Center shows 30-day totals and a 7-day trend. Student pledges are self-reported.
4. **AI-style Food Recommendation** — explainable ranking based on the student's previous purchases, campus popularity over the last 30 days and current stock. This is a local recommendation algorithm, not a hosted generative-AI model.
5. **Smart Lost & Found** — students can post lost/found items with a PNG/JPG/WEBP photo (maximum 2 MB), description and location. Hall Admin can mark posts claimed, returned or closed. Public listing responses do not expose the poster's contact field.
6. **Emergency SOS & Campus Help** — students can send an emergency type, location, details and callback number. Hall Admin sees the alert and can acknowledge, respond or resolve it. The interface reminds users to contact local emergency services for immediate danger.

## API endpoints

- `GET /api/campus/queue` — student/teacher queue overview.
- `GET /api/campus/queue?restaurant=<id>` — Canteen Admin queue for selected restaurant.
- `GET /api/campus/live-tracking` — teacher-only: the signed-in teacher's active delivery orders and assigned rider location.
- `GET /api/campus/recommendations` — student/teacher recommendations.
- `GET|POST /api/campus/lost-found` — view or create Lost & Found posts.
- `PATCH /api/campus/lost-found/:id` — Hall Admin status update.
- `POST /api/campus/emergency` — student/teacher SOS submission.
- `GET /api/campus/emergency` — Hall Admin emergency inbox.
- `PATCH /api/campus/emergency/:id` — Hall Admin response status.
- `GET /api/campus/waste-challenge` — challenge stats and participation.
- `POST /api/campus/waste-challenge/join` — student/teacher joins.
- `POST /api/campus/waste-challenge/pledge` — one daily no-waste pledge.
- `POST /api/campus/waste-challenge` — Canteen Admin records meal waste for selected restaurant.

## Setup

1. Keep the existing MySQL database and run the server as usual (`cd backend`, `npm install`, `npm start`).
2. New tables are created automatically when the new API is first used. For manual setup, run `backend/migrations/20261030_campus_command_center.sql` after selecting the `campusdine` database.
3. The JSON body limit is now 4 MB to support the limited-size image upload. The image endpoint separately rejects files larger than 2 MB.
4. The package uses existing dependencies only; no additional `npm install` package is required.

## Validation performed

- Node syntax check passed for `backend/server.js` and `backend/src/routes/campusFeatures.js`.
- Hall Admin inline JavaScript passed `node --check`.
- Database-backed integration tests and browser end-to-end tests still need to be run against the developer's local MySQL database and browser session.

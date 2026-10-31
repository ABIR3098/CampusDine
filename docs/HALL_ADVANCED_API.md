# Hall advanced API (rooms, visitors, laundry ...)

These routes live in `backend/src/hall/advanced.js` and are mounted under `/api/hall`, so they
share the access rules of the rest of the Hall module: a login token, role `student`, `teacher`
or `admin`, and students must have a Hall account. See [HALL_API.md](HALL_API.md) for the meal
routes. "admin" below means `role = admin`. An admin who is assigned to a university only sees
and changes that university's records.

Errors are `{ "error": "message" }` (`400` bad input, `403` not allowed, `404` not found,
`409` conflict).

## Profile

| Method and path | Who | What |
|---|---|---|
| `GET /profile` | all | Own Hall profile. |
| `PUT /profile` | all | Body `{ phone, emergencyContact, bloodGroup, department }`. Lengths are cut to 20, 180, 8 and 120 characters. Also copies `phone` to the `users` table. |

## Rooms

| Method and path | Who | What |
|---|---|---|
| `GET /rooms?hall=&available=1` | all | Room list with `vacancy`. Students and teachers only see rooms that are `available` and not full; an admin sees all unless `available=1`. |
| `POST /rooms` | admin | Body `{ hallName, roomNumber, blockName?, floorNo?, roomType?, capacity, occupied? }`. `capacity` is 1 to 100, `occupied` cannot exceed it. `409` if the room already exists in that hall and block. |
| `PATCH /rooms/:id` | admin | Change `status` (`available`, `maintenance`, `inactive`), `capacity`, `roomNumber`, `hallName`, `blockName`, `floorNo`, `roomType`. |
| `POST /room-applications` | all | Body `{ preferredHall?, notes?, roomId? }`. One pending application per student (`409`). If `roomId` is given the room must be available. |
| `GET /room-applications?status=` | all | A student sees own applications; an admin sees all. |
| `PATCH /room-applications/:id/withdraw` | owner | Withdraws a pending application. |
| `PATCH /room-applications/:id` | admin | Body `{ status: "approved" \| "rejected" }`. Only a `pending` application can be reviewed (`409` otherwise). Approving without a chosen room picks the emptiest available room (matching `preferredHall` if set) and fails with `409` if none is vacant or the student already has an active room. |
| `GET /room-assignments` | admin | Active assignments. |
| `GET /room-history` | all | Own room history (an admin can pass `?userId=`). |
| `POST /room-assignments/:id/transfer` | admin | Body `{ roomId }`. **`:id` is the student's user id, not an assignment id.** Moves the student to a room that has space and updates `users.hall_name` and `room_number`. |
| `POST /room-assignments/:id/checkout` | admin | **`:id` is the student's user id.** Ends the active assignment. |

## Visitors, facilities, clearance

| Method and path | Who | What |
|---|---|---|
| `GET /visitors` | all | Own requests; an admin sees all. |
| `POST /visitors` | all | Body `{ visitorName, visitDate, phone?, purpose?, expectedTime? }`. `visitDate` is `YYYY-MM-DD` and cannot be in the past; `expectedTime` is `HH:MM`. |
| `PATCH /visitors/:id` | admin | Body `{ status }`: `approved`, `rejected`, `checked_in` or `checked_out`. The student gets a notification. |
| `GET /facility-bookings` | all | Own bookings; an admin sees all. |
| `POST /facility-bookings` | all | Body `{ facilityName, bookingDate, startTime, endTime }`. `HH:MM`, start before end. `409` if it overlaps a `pending` or `approved` booking of the same facility and date. |
| `PATCH /facility-bookings/:id` | admin | Body `{ status, reviewNote? }`: `approved`, `rejected` or `completed`. |
| `GET /clearance` | all | Own requests; an admin sees all. |
| `POST /clearance` | all | Body `{ reason? }`. One open (`pending` or `in_review`) request at a time (`409`). |
| `PATCH /clearance/:id` | admin | Body `{ status, reviewNote?, checklist? }`: `in_review`, `approved` or `rejected`. `checklist` is an array, at most 50 items. |

## Laundry

| Method and path | Who | What |
|---|---|---|
| `GET /laundry/vendors` | all | Students only see active vendors. |
| `POST /laundry/vendors` | admin | Add a vendor (name required). |
| `PATCH /laundry/vendors/:id` | admin | Edit a vendor, for example make it inactive. |
| `GET /laundry/jobs` | all | Own jobs; an admin sees all. |
| `POST /laundry/jobs` | all | Body `{ description, pieces, vendorId? }`. `description` up to 500 characters, `pieces` 1 to 100, the vendor must be active. |
| `PATCH /laundry/jobs/:id` | owner or admin | Body `{ status, vendorId? }`: `accepted`, `picked_up`, `ready`, `delivered`, `cancelled`. A student may only set `cancelled` on their own job (`403` otherwise). |
| `PATCH /laundry/jobs/:id/rating` | owner | Body `{ rating: 1-5, feedback? }`. Only a `delivered` job can be rated. |

## Complaints, leave and incidents

These three create a row in `hall_requests` (the same table as `/api/hall/services`), so the
admin sees them together with other service requests.

| Method and path | Who | Body |
|---|---|---|
| `POST /leave-requests` | all | `{ startDate, endDate, reason }`. `endDate` cannot be before `startDate`. |
| `POST /complaints` | all | `{ title, description, location? }`. Title at least 3 characters. |
| `POST /incidents` | all | `{ title, description, location? }`. Title at least 3 characters. |

## Notifications

| Method and path | Who | What |
|---|---|---|
| `GET /notifications` | all | Own 100 latest notifications. |
| `PATCH /notifications/:id/read` | owner | Marks one as read. |
| `POST /notifications/test-email` | admin | Body `{ email }`. `503` if SMTP is not set up. |

A notification is saved in the database, pushed live as the Socket.IO event `hall:notification`
to the room `user:<id>`, and e-mailed too when `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are set.
If the push or e-mail fails, only a warning is logged; the saved notification stays.

## Admin only: kitchen, universities and numbers

| Method and path | What |
|---|---|
| `GET /suppliers`, `POST /suppliers` | Supplier list; add one (name required). |
| `GET /production-plans`, `POST /production-plans` | Body `{ date, slot, plannedPlates, actualPrepared?, notes? }`. `plannedPlates` 0 to 100000. |
| `GET /analytics` | Open requests, maintenance still open, requests by type (last 30 days), plates prepared, served and wasted (last 30 days). |
| `GET /admin/overview` | Request counts and room totals (rooms, capacity, occupied). |
| `GET /universities`, `POST /universities` | List or add a university (name required). |
| `GET /university-users` | Users with their university. |
| `PATCH /users/:id/university` | Assign a user to a university. An admin tied to one university can only assign within it (`403`). |

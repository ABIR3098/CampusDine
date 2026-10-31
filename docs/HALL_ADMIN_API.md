# Hall Admin API (`/api/hall-admin`)

The Hall Admin is a separate role (`hall_admin`) with its own console, `frontend/hall-admin.html`,
which is served at `/hall-admin.html`. Code: `backend/src/routes/hallAdmin.js`. This role is
**not** the canteen `admin`. The canteen admin uses `/api/hall` ([HALL_API.md](HALL_API.md),
[HALL_ADVANCED_API.md](HALL_ADVANCED_API.md)); a `hall_admin` token is refused there.
The console also calls `/api/campus` for emergencies and Lost & Found, see
[CAMPUS_API.md](CAMPUS_API.md).

Errors are `{ "error": "message" }`.

## One account only

The system allows exactly **one** `hall_admin` user. Once it exists, sign-up answers `409`.
Creating it needs a working e-mail OTP; without SMTP the code is printed in the server console
(only when `NODE_ENV` is not `production`).

## Sign-up and login (no token needed)

| Method and path | Body | What |
|---|---|---|
| `POST /auth/send-otp` | `{ email }` | E-mails a 6-digit code. `409` if a Hall Admin already exists. |
| `POST /auth/register` | `{ name, email, externalId, password, otp }` | Creates the account. Password at least 8 characters (stored with bcrypt, cost 12). `409` if one exists or the ID/e-mail is taken. A database lock stops two sign-ups from racing (`503` if busy). Returns `201` with `{ success, id }`; you must then log in. |
| `POST /auth/login` | `{ identifier, password }` | `identifier` is the ID or the e-mail. If the password is right, a login code is e-mailed. Returns `{ otpRequired: true, challenge, emailed, email }` (e-mail is masked). `401` if the credentials are wrong. |
| `POST /auth/verify-login` | `{ challenge, otp }` | Finishes the login and returns `{ token, user }`. |

Login always needs the e-mail code: there is no way to skip it for this role. The `challenge`
is valid for 10 minutes, and the returned `token` for **8 hours** (other roles get `JWT_EXPIRES_IN`,
7 days by default). Send the token as `Authorization: Bearer <token>`.

The OTP rules (60-second resend wait, 5 codes per hour, 5 wrong tries per code) come from
`src/utils/otp.js`. Unlike the normal `/api/auth/login`, this login has no lock-out after wrong
passwords; only the code step is limited.

## Everything below needs a `hall_admin` token

| Method and path | What |
|---|---|
| `GET /requests` | The 300 newest student requests from `hall_requests` (maintenance, cleaning, complaint ...), with the student's name and ID. Sorted by status: `submitted`, `approved`, `in_progress`, then the closed ones. |
| `PATCH /requests/:id` | Body `{ status, adminNote? }`. `status` is one of `submitted`, `approved`, `in_progress`, `resolved`, `rejected`, `cancelled`. The note is cut to 500 characters. The student gets a saved notification ("status is now ..."). `404` if the id is unknown. |
| `GET /notices` | Active notices (not expired), pinned first, at most 200. |
| `POST /notices` | Body `{ title, body, category?, pinned?, expires_at? }`. Title at least 3 characters; `category` defaults to `General`. Returns `201 { success, id }`. |
| `DELETE /notices/:id` | Deletes a notice. |
| `GET /dashboard` | `{ counts, recent }`: the number of items per type and status, and the 100 newest items. |
| `POST /items` | Body `{ item_type, title, details?, student_id?, assigned_to?, expires_at? }`. `item_type` is one of `complaint`, `service`, `notice`, `incident`, `leave`, `visitor`, `booking`, `lost_found`, `event`. The new item starts as `Pending`. |
| `PATCH /items/:id` | Body `{ status, assigned_to? }`. `status` is one of `Pending`, `In Progress`, `Resolved`, `Approved`, `Rejected`, `Closed`, `Pinned`. |

## Things to know

- **Two different tables.** `/requests` works on `hall_requests`, the table students fill through
  `/api/hall/services`, `/complaints` and similar. `/items` and `/dashboard` work on
  `hall_admin_items`, which the Hall Admin fills by hand. Student requests do **not** appear in
  `/dashboard`.
- **No university filter.** These routes see every university's data.
- **Notices and universities.** A notice made here has no `university_id`. `GET /api/hall/notices`
  only returns notices of the student's own university when the student is assigned to one, so
  such a student does not see Hall Admin notices. Students without a university see them.
- Status words differ: `/requests` uses lower-case words (`in_progress`), `/items` uses
  capitalised ones (`In Progress`).

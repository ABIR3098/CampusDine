# API routes

Every route registered in the backend, grouped by the file that defines it. Paths are relative to the group's prefix. Most routes need a login token; see `backend/src/middleware/auth.js`.

## `/api/auth` — `src/routes/auth.js`

- `GET /api/auth/availability`
- `GET /api/auth/config`
- `POST /api/auth/otp/send-signup`
- `POST /api/auth/forgot-password`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/login/verify`
- `POST /api/auth/login/resend`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `POST /api/auth/reset-password`

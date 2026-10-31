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

## `/api/menu` — `src/routes/menu.js`

- `GET /api/menu`
- `POST /api/menu/:id/favorite`
- `DELETE /api/menu/:id/favorite`
- `POST /api/menu`
- `PUT /api/menu/:id`
- `GET /api/menu/alerts`
- `POST /api/menu/:id/notify`
- `DELETE /api/menu/:id/notify`

## `/api/orders` — `src/routes/orders.js`

- `POST /api/orders`
- `GET /api/orders/mine`
- `GET /api/orders`
- `PATCH /api/orders/:id/cancel`
- `POST /api/orders/verify`
- `PATCH /api/orders/:id/advance`
- `POST /api/orders/:id/rate-rider`
- `POST /api/orders/:id/feedback`
- `POST /api/orders/:id/report`
- `GET /api/orders/issues/mine`
- `GET /api/orders/issues`
- `PATCH /api/orders/issues/:id`

## `/api/riders` — `src/routes/riders.js`

- `POST /api/riders/orders/assign-pending`
- `GET /api/riders/orders`
- `POST /api/riders/orders/:orderId/accept`
- `POST /api/riders/location`
- `GET /api/riders/orders/summary`
- `GET /api/riders/locations`

## `/api/operations` — `src/routes/operations.js`

- `GET /api/operations/riders/shift/me`
- `POST /api/operations/riders/shift/start`
- `POST /api/operations/riders/shift/end`
- `GET /api/operations/riders/shifts`
- `GET /api/operations/riders/assignable-orders`
- `POST /api/operations/orders/:id/assign-rider`
- `GET /api/operations/analytics`
- `GET /api/operations/fraud-events`
- `GET /api/operations/audit`
- `GET /api/operations/riders/route`

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

## `/api/group-orders` — `src/routes/groupOrders.js`

- `POST /api/group-orders`
- `POST /api/group-orders/join`
- `GET /api/group-orders`
- `GET /api/group-orders/:id`
- `POST /api/group-orders/:id/items`
- `POST /api/group-orders/:id/close`

## `/api/wallet` — `src/routes/wallet.js`

- `GET /api/wallet`
- `POST /api/wallet/topup`
- `GET /api/wallet/recipient`
- `POST /api/wallet/transfer`
- `GET /api/wallet/referral`

## `/api/calendar` — `src/routes/calendar.js`

- `GET /api/calendar`
- `GET /api/calendar/bill`
- `POST /api/calendar/pay`
- `POST /api/calendar/repeat`
- `PUT /api/calendar/:day`

## `/api/recurring` — `src/routes/recurring.js`

- `GET /api/recurring`
- `GET /api/recurring/due`
- `POST /api/recurring`
- `PATCH /api/recurring/:id`
- `DELETE /api/recurring/:id`
- `POST /api/recurring/:id/done`

## `/api/admin` — `src/routes/admin.js`

- `GET /api/admin/overview`
- `GET /api/admin/reports/revenue-trend`
- `GET /api/admin/reports/forecast`
- `GET /api/admin/reports/summary`
- `GET /api/admin/reports/export`
- `GET /api/admin/feedback`
- `POST /api/admin/announcement`

## `/api/coupon` — `src/routes/coupon.js`

- `POST /api/coupon/validate`
- `POST /api/coupon/apply`
- `GET /api/coupon/available`
- `POST /api/coupon`
- `GET /api/coupon`
- `PUT /api/coupon/:couponId`

## `/api/chat` — `src/routes/chat.js`

- `GET /api/chat/conversations`
- `GET /api/chat/messages`
- `GET /api/chat/:userId/messages`
- `POST /api/chat/messages`
- `GET /api/chat/order/:orderId/messages`
- `POST /api/chat/order/:orderId/messages`
- `DELETE /api/chat/messages/:id`
- `GET /api/chat/presence`
- `POST /api/chat/images`
- `GET /api/chat/images/:id`
- `POST /api/chat/messages/:id/reaction`

## `/api/feedback` — `src/routes/feedback.js`

- `POST /api/feedback`
- `GET /api/feedback/mine`

## `/api/summary` — `src/routes/summary.js`

- `GET /api/summary`
- `GET /api/summary/budget`
- `PUT /api/summary/budget`

## `/api/hall-admin` — `src/routes/hallAdmin.js`

- `POST /api/hall-admin/auth/send-otp`
- `POST /api/hall-admin/auth/register`
- `POST /api/hall-admin/auth/login`
- `POST /api/hall-admin/auth/verify-login`
- `GET /api/hall-admin/requests`
- `PATCH /api/hall-admin/requests/:id`
- `GET /api/hall-admin/notices`
- `POST /api/hall-admin/notices`
- `DELETE /api/hall-admin/notices/:id`
- `GET /api/hall-admin/dashboard`
- `POST /api/hall-admin/items`
- `PATCH /api/hall-admin/items/:id`

## `/api/campus` — `src/routes/campusFeatures.js`

- `GET /api/campus/queue`
- `GET /api/campus/live-tracking`
- `GET /api/campus/recommendations`
- `GET /api/campus/lost-found`
- `POST /api/campus/lost-found`
- `PATCH /api/campus/lost-found/:id`
- `POST /api/campus/emergency`
- `GET /api/campus/emergency`
- `PATCH /api/campus/emergency/:id`
- `GET /api/campus/waste-challenge`
- `POST /api/campus/waste-challenge/join`
- `POST /api/campus/waste-challenge/pledge`
- `POST /api/campus/waste-challenge`

## `/api/pricing` — `src/routes/offers.js`

- `POST /api/pricing/quote`

## `/api/loyalty` — `src/routes/offers.js`

- `GET /api/loyalty/me`
- `GET /api/loyalty/settings`
- `PUT /api/loyalty/settings`

## `/api/offers` — `src/routes/offers.js`

- `GET /api/offers`
- `GET /api/offers/admin`
- `POST /api/offers/admin/combos`
- `PUT /api/offers/admin/combos/:id`
- `POST /api/offers/admin/happy-hours`
- `PUT /api/offers/admin/happy-hours/:id`
- `POST /api/offers/admin/rewards`
- `PUT /api/offers/admin/rewards/:id`
- `DELETE /api/offers/admin/:kind/:id`

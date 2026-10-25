# CampusDine Hall Module — Implemented Features

This update is based on the supplied main project. Hall payments and wallet features are intentionally excluded from the Hall navigation and Hall API routes.

## Hall student login
- Student accounts with `account_type = 'hall'` go directly to the Hall module after login.
- Regular student accounts continue to the existing restaurant picker.
- Existing teacher/admin/rider login flow is unchanged.

## Hall meal operations
- Existing daily meal ON/OFF, weekly menu, cut-off times, guest plates, feast menu and meal reports are retained.
- Hall profile remains available.
- Monthly bill and wallet/token-payment tabs/routes are not exposed in Hall.

## Added hall operations
- Service requests: maintenance/repair, cleaning, laundry, guest entry, lost & found, facility booking, feedback, urgent issue and hall event/catering.
- Students see their own requests and may cancel eligible requests; admins can update request status.
- Hall notice board with pinned notices and admin publishing/deletion.
- Kitchen/supply inventory with quantity, units, minimum stock and low-stock indicator.
- Food-waste records for prepared/served/wasted plates.
- Historical meal-demand estimate based on the last 56 days of hall meal selections.
- Admin overview and audit log.

## Database
On server startup, `ensureHallExtraSchema` creates these tables safely if missing:
`hall_requests`, `hall_notices`, `hall_inventory`, `hall_pickup_tokens`, `hall_food_waste`, `hall_audit_log`.

## Run
1. Extract the ZIP.
2. Configure `backend/.env` for your local MySQL database and JWT secret.
3. Import `backend/schema.sql` if this is a fresh database.
4. In `backend`, run `npm install` (if needed), then `npm start`.
5. Open the normal CampusDine frontend and sign in using a Student account registered as a Hall account.

The forecast is a simple historical estimate, not an AI prediction service. Payment/wallet, laundry vendors, actual QR attendance scanning, push/email delivery, room assignment administration and multi-university tenancy are not claimed as completed integrations.

# CampusDine Hall Module — Implementation Notes

This implementation modifies the existing CampusDine project. It does not create a separate demo app. Hall navigation and Hall-specific APIs do not expose wallet/top-up/payment functionality.

## Implemented workflows

1. **Room assignment:** admin room inventory, capacity/vacancy, student room application, approve/reject, automatic assignment, room transfer, check-out, and room history.
2. **Meal pickup QR:** existing unique pickup tokens, QR generation in the Hall UI, camera scanning using the browser `BarcodeDetector` API where supported, manual token entry fallback, and server-side single-use verification.
3. **Notifications:** persisted in-app notifications, authenticated Socket.IO `hall:notification` events, optional desktop notifications while the Hall page is open, and optional SMTP email delivery.
4. **Laundry:** vendor directory, active/inactive vendor management, student service requests, status lifecycle, and rating after delivery.
5. **University directory:** university creation, user-to-university assignment, and tenant-aware scoping for newly added Hall operations and inventory/request/notice/token/waste/audit records when a user is assigned to a university.
6. **Student profile / digital Hall ID:** contact and emergency details, blood group, department, hall/room information, and stable digital ID fallback.
7. **Leave and visitors:** date-range leave request, visitor approval/rejection/check-in/check-out.
8. **Complaints and maintenance:** service requests support maintenance, cleaning, complaints, and request status review.
9. **Facilities and incidents:** facility booking with overlap prevention, plus incident report creation and admin review through service requests.
10. **Hall clearance:** request, in-review, approve/reject, checklist and review note.
11. **Kitchen inventory and suppliers:** quantity/unit/minimum-stock tracking, low-stock reporting, supplier directory.
12. **Production and forecast:** date/meal production plans plus the existing 56-day historical meal-demand estimate.
13. **Analytics:** request breakdown, prepared/served/wasted plates and waste rate over the last 30 days.
14. **Audit and access control:** audit events for core actions; administrative endpoints use the existing admin-role middleware.
15. **Hall operations UI:** the Hall Operations tab includes rooms, applications, profile, leave/complaints, visitors, facilities, clearance, laundry, notifications, supplier/production admin panels, analytics, university directory, and QR scanning.

## Setup

1. Keep a backup of the existing project and extract this project to a new folder.
2. Copy `backend/.env.example` to `backend/.env` and set the existing MySQL credentials and a persistent `JWT_SECRET`.
3. Start XAMPP/MySQL and make sure the CampusDine database from `backend/schema.sql` exists. The server creates the Hall extension tables and compatible columns at startup.
4. In PowerShell, open the `backend` folder and run `npm install`, then `npm start`.
5. Log in with a Student account whose `account_type` is `hall`. Use an Admin account to create rooms and review applications.
6. For real email delivery, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_SECURE=true`, and `SMTP_FROM` in `backend/.env`. Use the Hall Operations → Notifications → Test email control to verify configuration.
7. Camera QR scanning requires browser camera permission and a secure context (localhost or HTTPS). If camera scanning is unavailable, use manual token entry.

## Notes

- The historical demand forecast is a simple average-based estimate, not an AI service.
- Desktop notifications work while the Hall page is open and permission is granted; email requires SMTP configuration. No VAPID/browser push subscription service is configured.
- University scoping is applied to the new operational records and the extended room/request/notice/inventory/token/waste/audit workflows. The pre-existing weekly menu and meal-slot cutoff/price configuration remains shared across universities; meal reports and newly added operational records are tenant-scoped. Per-university weekly menus and per-university slot pricing would need a separate data migration before a production deployment that requires different menus or pricing by university.
- End-to-end tests require the user's local MySQL database and credentials. This package was checked for JavaScript syntax and JSX transpilation, but was not tested against a live database in this environment.
- Hall wallet/payment features are intentionally excluded from the Hall Operations UI and new Hall APIs.

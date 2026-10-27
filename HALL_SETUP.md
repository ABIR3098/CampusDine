# Hall module configuration checklist

## Database

The server runs idempotent schema setup at startup for room inventory/applications/assignment history, visitor requests, facility bookings, clearance, laundry vendors/jobs, suppliers, production plans, student profile data, notifications, and university records. Existing installations are migrated with compatible `ALTER TABLE` statements.

For a fresh install, first create the CampusDine database and import `backend/schema.sql`, then configure `backend/.env`.

## SMTP email

Add to `backend/.env` (example values only; replace them with your provider settings):

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=CampusDine Hall <no-reply@example.com>
```

Restart the backend after changing `.env`. Admins can use the Hall Operations notification panel to send a test email. Notification emails are sent only when SMTP variables are configured and the recipient user has an email address.

## University assignment

Use Hall Operations → Universities to create university records and assign users. Admins without a university assignment can manage the directory globally; an admin assigned to one university is limited to that university for the newly added scoped workflows.

## QR scanner

Open Hall Operations → QR scanner while logged in as an admin, allow camera access, and point the camera at a meal pickup token. On browsers without `BarcodeDetector`, enter the token manually. The backend marks an issued token served once; repeat scans fail.

## No Hall payments

The new Hall Operations module does not add wallet, top-up, or payment actions.

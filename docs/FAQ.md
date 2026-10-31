# FAQ

Short answers to common setup questions.

## Which port does the server use?
The `PORT` value in `backend/.env` (`5000` in `.env.example`). The server also serves the frontend, so open that address in the browser.

## I have no email provider. How do I get the OTP code?
Leave `SMTP_HOST` empty. The code is printed in the server console while developing.

## Can I skip the email code on sign-up?
Set `EMAIL_OTP_REQUIRED=false` in `backend/.env`.

## Can I turn off the login code?
`LOGIN_OTP` controls it: `all` (every account with an email), `admin` (admin accounts only) or `off`.

## Pickup times or reports look off by some hours
Set `CANTEEN_TZ` in `backend/.env` to the canteen's timezone. The default is `Asia/Dhaka`.

## How do I add more food items?
See [Adding menu items](MENU_ITEMS_SQL.md).

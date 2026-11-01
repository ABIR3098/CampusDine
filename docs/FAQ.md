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

## How do I change the hall weekly menu?
Hall admins can edit it in the app, or you can change the starting sample menu. See [Hall weekly menu](HALL_MENU.md).

## Which restaurant does an item belong to?
Built-in items are listed per restaurant in `backend/src/catalog.js` (`ITEMS_BY_RESTAURANT`). Items added later are remembered in the `app_meta` table.

## How do I run the tests?
Run `npm test` inside the `backend` folder (Node 18 or newer).

## Why is there no `.env` in the repository?
It holds passwords and secrets, so `.gitignore` excludes it. Copy `backend/.env.example` to `backend/.env` and fill in your own values.

## Why does a new menu item show no calories?
Calories and allergens live in `NUTRITION_BY_NAME` in `backend/src/catalog.js`. Items that are not listed there simply show no nutrition badges. Add a line for the item to fix it.

## Why does my rider not get a teacher order?
Check these in order: the order is from a **teacher** (student orders are collected at the counter); the rider pressed **Start Duty Shift**; the rider app shows GPS or **Demo GPS** as active (a position older than 90 seconds does not count); the rider has fewer active orders than the shift limit. The app shows a red warning for the first cases. A waiting order is offered again every 20 seconds (`RIDER_DISPATCH_SECONDS`), so it usually arrives within half a minute after the rider is ready. See [RIDERS_API.md](RIDERS_API.md).

## Can I test riders without a phone GPS?
Yes. In the rider app press **Demo GPS** (next to Enable GPS). It shares a fixed campus position, so the rider can go on duty on a desktop browser or without HTTPS.

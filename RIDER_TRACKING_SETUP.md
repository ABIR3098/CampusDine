# CampusDine Rider Tracking Setup

## What changed
- Added a dedicated `rider` login role (not available for public sign-up).
- Rider devices can share GPS only while they choose Start GPS sharing.
- Only authenticated teacher accounts can access the Rider Tracking tab and see active riders on OpenStreetMap.
- Student order tracking no longer shows GPS or exposes GPS coordinates through the order tracking response.
- Smart order tracking remains: Received → Cooking → Ready, timestamps/history, ETA, Socket.IO updates and reconnect refresh.

## Demo rider account
- ID: `rider1`
- Password: `rider123`

The backend creates this demo account if that ID does not already exist. Change/remove the demo password before any real deployment.

## Run
1. Start XAMPP MySQL.
2. Ensure `backend/.env` has the correct database credentials and `JWT_SECRET`.
3. From `backend`, run `npm install` (if needed) and `npm start`.
4. Log in as rider1 / rider123, allow browser location permission, and click Start GPS sharing. Browser geolocation requires HTTPS or localhost.
5. Log in as a teacher (demo: `teacher1` / `teacher123`) and open the Rider Tracking tab.

The app automatically adds the `rider` enum value and creates the `rider_locations` table at backend startup. Location is sent to teachers via Socket.IO and also refreshed every 10 seconds.


## Rider account, OTP and orders update
- Rider can create an account from the Delivery Rider portal; signup email OTP is required when `EMAIL_OTP_REQUIRED=true`.
- Rider login OTP uses `LOGIN_OTP=all` and an email address on the account.
- Rider Forgot Password uses the existing email OTP reset flow.
- Rider dashboard shows aggregate active-order counts and a recent order list without exposing customer personal details.
- GPS sharing is stored in browser localStorage and the background tracker remains mounted after logout while the page stays open. Use Stop GPS Sharing to stop it. Browser/tab closure and mobile OS background restrictions can still stop location updates; this is not native background tracking.

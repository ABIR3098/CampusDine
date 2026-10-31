# Architecture

One Node process serves the API, the Socket.IO channel and the frontend files.

```
browser ── HTTP /api/* ──► Express (backend/server.js) ──► MySQL
   │                          │  routes: src/routes/*, src/hall/routes/*
   └── Socket.IO ◄────────────┘  rooms: user:<id>, admins, hall_admins, teachers, rider:<id>
```

## Entry point
`npm start` runs `backend/server.js`. `server-enhanced.js` and the `*-enhanced.js` routes are an older branch and are not used.

## Start-up
1. Connect to MySQL and check that the `users` table exists (import `schema.sql` first).
2. Run the idempotent `ensure*Schema` steps that add newer tables and columns.
3. Create the demo accounts if they are missing.
4. Listen on `PORT` and start the hall background jobs (meal auto-fill, auto-pay).

## Backend layout
| Folder | Purpose |
|---|---|
| `src/routes/` | Canteen API: auth, menu, orders, wallet, riders, coupons, chat, campus features |
| `src/hall/` | Hall meal system: slots, meals, feasts, bill, finance, diet, services |
| `src/utils/` | Pure helpers: clock, pickup, order rules, OTP, QR tokens |
| `src/middleware/auth.js` | `verifyToken` (JWT) and `requireRole` |
| `tests/` | Node built-in test runner, pure helpers only |

## Roles
`student`, `teacher`, `admin` (canteen), `rider`, `hall_admin`. Public sign-up allows student, teacher and rider only.

## Frontend
`frontend/campusdine.html` is a single page using React, Babel and Tailwind from CDNs. The hall screens are JSX files in `frontend/hall/`, listed in `files.js` and compiled in the browser by `loader.js`.

## Money rules
- Order placement locks the menu rows and the wallet row inside one transaction.
- Wallet transfers lock both wallets, lowest id first.
- Wallet top-up is simulated and has no real payment gateway.

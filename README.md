# CampusDine — Full Project (Frontend + Backend)

BUP · CSE 3208 Software Development Project I · CampusDine

```
campusdine-project/
├── frontend/
│   └── campusdine.html      ← served automatically by the backend
└── backend/
    ├── server.js             ← Express + Socket.io API + serves the frontend
    ├── schema.sql             ← MySQL tables + menu seed data
    ├── src/routes/            ← auth, menu, orders, wallet, calendar, admin
    ├── package.json
    ├── .env.example
    └── README.md              ← detailed backend-only reference
```

**One server, one command, one URL.** The backend now serves the frontend
file directly (like your CropTrack project did), so there's no separate
frontend server, no CORS setup, and no `file://` browser restrictions to
fight with. It also auto-creates three demo accounts the first time it
connects to the database, so you can log in immediately without
registering anything by hand.

---

## Run it — start to finish

### 1. Install prerequisites
- **Node.js** v18+ — check with `node -v`. Get it from https://nodejs.org (LTS).
- **MySQL** — install directly, or install **XAMPP**
  (https://www.apachefriends.org), which bundles MySQL + phpMyAdmin.
  Start MySQL from the XAMPP control panel.

### 2. Create the database (via phpMyAdmin)
1. Open `http://localhost/phpmyadmin`.
2. Click **New** in the left sidebar → database name `campusdine` →
   collation `utf8mb4_general_ci` → **Create**.
3. With `campusdine` selected, click the **Import** tab → **Choose File**
   → select `backend/schema.sql` → **Go**.
4. You should see "Import has been successfully finished" and 7 tables
   listed on the left (users, menu_items, orders, order_items,
   wallet_transactions, meal_calendar, meal_rates).

(Prefer the command line instead? `mysql -u root -p campusdine < schema.sql` works the same way.)

### 3. Configure the backend
```bash
cd backend
cp .env.example .env
```
Open `.env`. For XAMPP's defaults, this is already correct:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=campusdine
JWT_SECRET=<any long random string>
CORS_ORIGIN=*
```

### 4. Install and run
```bash
npm install
npm run dev
```
Watch the terminal — it checks the database connection itself and tells
you in plain language what's wrong if something fails (MySQL not
running, database missing, wrong password, etc). On success you'll see:

```
✅ Demo account তৈরি হয়েছে: admin / admin123 (admin)
✅ Demo account তৈরি হয়েছে: student1 / student123 (student)
✅ Demo account তৈরি হয়েছে: teacher1 / teacher123 (teacher)

🔑 LOGIN দিয়ে test করো:
   Admin   → ID: admin      Password: admin123
   Student → ID: student1   Password: student123
   Teacher → ID: teacher1   Password: teacher123

🚀 CampusDine চালু হয়েছে → http://localhost:5000
```

### 5. Open the app
Just visit **http://localhost:5000** in your browser. That's it — no
second terminal, no separate file to open. Log in with any of the demo
accounts above, or use "Create account" to register a new one.

Leave this terminal running the whole time you're using the app.

---

## What's live

- **Login/Register** → real accounts in MySQL, JWT-based sessions.
- **Menu & Order** → real stock/prices; checkout creates a real order,
  deducts real stock, and (if paying by wallet) deducts a real balance.
- **Track Order** → your real order history; status updates push live the
  instant an admin advances an order (Socket.io) — no refresh needed.
- **Meal Calendar** → clicks save to the database; the monthly bill is
  computed server-side using your role's rate.
- **Wallet** → real balance and transaction history; top-ups persist.
- **Admin Overview / Menu / Orders / Reports** → all pulled live from the
  database.

---

## Troubleshooting

- **`npm run dev` prints a ❌ and exits** — read the 👉 line right under
  it; it names the exact fix (start MySQL, import schema.sql, or fix
  `.env`).
- **"Cannot GET /"** — you're at the wrong path; the app is now at
  `http://localhost:5000` directly (not `/api/...`).
- **Blank page / console shows "Cannot use import statement"** — a stale
  browser cache from an older version of this file. Hard-refresh with
  `Ctrl+Shift+R`.
- **"Insufficient wallet balance"** — top up from the Wallet tab, or pay
  cash on pickup instead.
- **Green dot next to the logo stays grey** — the Socket.io connection
  hasn't come up yet; refresh the page once the server's fully started.

---

## Deploying to Vercel

This project is not a single Vercel deployment: the frontend is a static
HTML app, while the backend needs a persistent Node.js process, MySQL, and
Socket.IO. Deploy them separately:

1. Import this repository into Vercel and set **Root Directory** to
   `frontend`. Select **Other** as the framework preset and leave the build
   command empty. `frontend/vercel.json` routes the site root to
   `campusdine.html`.
2. Deploy `backend/` to a Node.js host that supports persistent servers
   (for example Render or Railway), and connect it to a managed MySQL
   database. Set the backend environment variables from `backend/.env.example`;
   use a strong `JWT_SECRET` and set `CORS_ORIGIN` to the Vercel site URL.
3. Open the Vercel site, select **Backend Server Host** on the login screen,
   and enter the deployed backend's base URL (for example,
   `https://your-api.example.com`). The frontend cannot use Vercel's own URL
   as its API host unless the backend is deployed there too.

Deploying the repository root as a Vercel app will not work: there is no
root-level frontend build, and the backend exits at startup if its required
MySQL configuration/database is not available. The backend also starts an
HTTP/Socket.IO server, so it should run on a persistent Node host rather than
as Vercel functions.

For payments, replace the wallet top-up flow with the SSLCommerz or bKash
sandbox API — `wallet_transactions` already has everything needed to log
gateway callbacks.

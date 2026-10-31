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

More documentation lives in [`docs/`](docs/) (see [Hall weekly menu](docs/HALL_MENU.md) [Adding menu items](docs/MENU_ITEMS_SQL.md) and [Environment variables](docs/ENVIRONMENT.md)).

---

## Restaurants

CampusDine has four restaurants — **Amitié (Friendship)**, **Vista Cafeteria**, **Third Place** and
**Staff Canteen** — each with its own logo (`frontend/images/restaurants/`). After login, every role
(student, teacher/staff and admin) first chooses a restaurant, and from then on sees only that
restaurant's menu; an admin also sees only its orders and overview numbers.

No database change is needed:
- Which restaurant an item belongs to is set by item name in `backend/src/catalog.js`
  (`ITEMS_BY_RESTAURANT`); every item belongs to exactly one restaurant and the list order is the menu order.
- Items an admin adds later are remembered in the existing `app_meta` table (`item_restaurant_<id>`).
- An order's restaurant is worked out from its items; a single order can only hold one restaurant's items.
- Reports (revenue trend, summary, CSV) are still campus-wide.

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
- **Menu Book** → front page → *More on the full menu* → *Menu Book* opens a
  full-screen page with the *Good Food, Better Days* picture as background, a
  **Back** button and a **View Menu** button. View Menu opens the 3D leather
  menu book (`frontend/menu-book.js`, pictures in `frontend/images/menu-book/`)
  on top of that picture; Esc or the cross closes the book, Back leaves the page.

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

## Deploying (optional, Phase 5 of your report)

- **Backend + MySQL + frontend, all together:** Render or Railway — since
  one server now serves everything, deploy `backend/` as a single Node
  web service (`npm start`), pointed at a managed MySQL instance with the
  same variables as `.env`.
- **Payments:** swap the wallet top-up flow for the SSLCommerz or bKash
  sandbox API — `wallet_transactions` already has everything needed to
  log gateway callbacks.

## Live tracking update

The updated project includes Smart Order Tracking (Received → Cooking → Ready), estimated ready time, status history timestamps, notifications, and Socket.IO refresh/reconnect handling. GPS is restricted to the dedicated Rider role: riders choose when to share their device location, and only authenticated teachers can see active riders on the Rider Tracking tab. Student order pages and customer tracking APIs do not expose GPS coordinates. See [`LIVE_TRACKING_SETUP.md`](LIVE_TRACKING_SETUP.md) and [`RIDER_TRACKING_SETUP.md`](RIDER_TRACKING_SETUP.md) for setup and test instructions. The backend adds the rider role and location table automatically at startup.

## New Campus Command Center features

See [CAMPUSDINE_NEW_FEATURES.md](CAMPUSDINE_NEW_FEATURES.md) for the new Canteen/Hall Command Center role split, Smart Live Order Tracking, Smart Queue Management, Food Waste Challenge, recommendation engine, Lost & Found image uploads, Emergency SOS endpoints and setup instructions.

---

## Running the tests

The backend tests use Node's built-in test runner (Node 18+):

```
cd backend
npm test
```

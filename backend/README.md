# CampusDine Backend

REST + WebSocket API for CampusDine (CSE 3208 Software Development Project I),
implementing Phase 2–4 of the project's phased plan: menu, ordering/token
tracking, subscription-calendar billing, wallet, and admin reporting, backed
by MySQL, with JWT auth and live order-status push via Socket.io.

## 1. Install prerequisites

- **Node.js** v18 or later — check with `node -v`. If missing, install from
  https://nodejs.org (LTS version).
- **MySQL Server** 8.x — either install it directly, or install **XAMPP**
  (includes MySQL + phpMyAdmin, easiest on Windows) from
  https://www.apachefriends.org and start the MySQL service from the XAMPP
  control panel.

## 2. Create the database

Open a terminal (or MySQL Workbench / phpMyAdmin) and run:

```bash
mysql -u root -p
```

Then inside the MySQL prompt:

```sql
CREATE DATABASE campusdine;
EXIT;
```

Now load the schema and seed data (menu items + meal rates) from this
project's folder:

```bash
mysql -u root -p campusdine < schema.sql
```

## 3. Install dependencies

From inside the `campusdine-backend` folder:

```bash
npm install
```

## 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your real MySQL password and a random `JWT_SECRET`
(any long random string — e.g. mash your keyboard for 40 characters).

## 5. Start the server

For development (auto-restarts on file changes):

```bash
npm run dev
```

Or for a plain run:

```bash
npm start
```

The server checks the database connection itself on startup and prints a
plain-language fix if something's wrong (MySQL not running, database
missing, wrong `.env` credentials). On success you'll see it auto-create
three demo accounts (admin / student1 / teacher1 — passwords in the
terminal output) and then:

```
🚀 CampusDine চালু হয়েছে → http://localhost:5000
```

This same server also serves the frontend — open `http://localhost:5000`
directly in a browser and log in with one of the printed demo accounts,
or register a new one from the UI. No separate frontend server needed.

## 6. Register more users

Need more accounts than the three demo ones? Either use "Create account"
in the app UI, or call the endpoint directly:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Abir Hasan","externalId":"24524203098","role":"student","password":"password123"}'
```

(No `curl`? Use Postman or Thunder Client in VS Code instead — same JSON body,
same URL, method POST.) Each response returns a `token`, needed as an
`Authorization: Bearer <token>` header on every other request if you're
calling the API directly rather than through the UI.

## 7. Try it out

```bash
# Log in
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"externalId":"24524203098","password":"password123"}'

# List the menu (replace TOKEN with the token from login)
curl http://localhost:5000/api/menu -H "Authorization: Bearer TOKEN"

# Place an order
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"id":1,"qty":2}],"paymentMethod":"wallet"}'
```

## 8. API reference (quick summary)

| Method | Endpoint                      | Role            | Purpose                              |
|--------|--------------------------------|-----------------|---------------------------------------|
| POST   | /api/auth/register             | anyone          | create an account                     |
| POST   | /api/auth/login                | anyone          | get a JWT                             |
| GET    | /api/menu                      | any logged-in   | list menu items                       |
| POST   | /api/menu                      | admin           | add a menu item                       |
| PUT    | /api/menu/:id                  | admin           | update price/stock/tag                |
| POST   | /api/orders                    | student/teacher | place an order, get a token           |
| GET    | /api/orders/mine                | student/teacher | my order history                      |
| GET    | /api/orders                    | admin           | live order queue                      |
| PATCH  | /api/orders/:id/advance        | admin           | Received → Cooking → Ready            |
| GET    | /api/wallet                    | any logged-in   | balance + transaction history         |
| POST   | /api/wallet/topup               | any logged-in   | add money to wallet                   |
| GET    | /api/calendar                  | any logged-in   | this month's marked days              |
| PUT    | /api/calendar/:day              | any logged-in   | mark a day off/full/half              |
| GET    | /api/calendar/bill              | any logged-in   | this month's auto-computed bill       |
| GET    | /api/admin/overview             | admin           | today's counts, revenue, low stock    |
| GET    | /api/admin/reports/revenue-trend| admin           | last 6 months' revenue                |
| GET    | /api/admin/reports/forecast     | admin           | predicted meal count for tomorrow     |

## 9. Frontend

`../frontend/campusdine.html` is already wired to this API — real login/
register, `fetch()` calls to every endpoint above with the JWT sent as an
`Authorization: Bearer` header, and a `socket.io-client` connection for live
`order:new` / `order:update` events. This server serves that file directly
(`express.static`), so starting the backend is the only step — just visit
`http://localhost:5000`. See the top-level `README.md` for the full walkthrough.

## 10. Deploying (Phase 5)

- **Backend + MySQL:** Render or Railway — create a MySQL instance, set the
  same environment variables as `.env` in the host's dashboard, deploy this
  folder as a Node web service (`npm start` as the start command).
- **Frontend:** Vercel or Netlify.
- **Payments:** swap the wallet top-up flow for the SSLCommerz or bKash
  sandbox API once you're ready for Phase 5 — the `wallet_transactions`
  table already has everything needed to log gateway callbacks.

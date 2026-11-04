# Kitchen Staff login & Inventory

## Run in VS Code

1. Install Node.js 18+ and MySQL (XAMPP / MySQL Server). Create the database once:
   `CREATE DATABASE campusdine;` then import `backend/schema.sql` (phpMyAdmin or `mysql -u root -p campusdine < backend/schema.sql`).
2. Open the `CampusDine` folder in VS Code → **Terminal → New Terminal**.
3. Copy `backend/.env.example` to `backend/.env` and set `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
4. Install and start:
   ```
   cd backend
   npm install
   npm start
   ```
5. The terminal prints the logins. Open http://localhost:5000

On start-up the server applies the migrations automatically (adds the `staff` role, creates the inventory tables, seeds
10 raw materials and creates the development staff account). The same SQL is in
`backend/migrations/20261101_staff_inventory.sql` if you prefer to run it by hand. Nothing existing is dropped or rewritten.

## Development staff login

| Field | Value |
| --- | --- |
| Portal | Kitchen Staff (role-select page) |
| Staff ID | `staff01` |
| Temporary password | `Staff@2026-Temp` |

The password is stored in the database only as a bcrypt hash. The account is not created when `NODE_ENV=production`.
Change the password before any real use.

## What each role can do

**Staff** – see raw material, current stock and unit (read-only); send a *stock report* or *purchase request* with current and
required quantity; see status, the admin's reply and the updated stock; message the admin in chat. Staff cannot change stock.

**Admin** (Inventory tab) – approve or reject requests with a reply (a reason is required for rejection), record purchases
(quantity, unit cost, supplier) which update the official stock, correct stock with a reason, add raw materials, and see
purchase and stock history.

**Restocking (admin)** – in the *Stock* tab every row has a **Restock** button, and so does each low-stock alert.
It opens the *Purchases* form with that material and a suggested quantity; enter what was bought (and cost/supplier),
press **Save**, and the official stock goes up and is written to the history. The form shows the stock before and after.
While not in production, a database failure shows its real reason on the admin screen (the server terminal prints it too).

**Daily usage** – staff record how much of a material was used (date, quantity, note). The system deducts it from the
official stock automatically, refuses usage above what is left, and shows **Low stock / Out of stock** alerts with a
"Request restock" button. Admin sees all usage in the *Daily usage* tab. Quantities like `35kg` or `৩৫` are accepted.

**Live updates** – the screens listen to the server's socket events (`inventory:request`, `inventory:decision`,
`inventory:alert`), so a new staff request shows up for the admin, and the admin's answer shows up for the staff member,
without a page reload.  Polling every 20 seconds stays as a fallback.

**How the admin answers a request** – *Purchase request*: **Approve** (then **Record purchase** with an optional message to
staff) or **Approve & record purchase** in one click, or **Reject** with a reason. *Stock report*: **Acknowledge**, then
optionally **Use staff count as official stock**, which saves a stock correction in the history.

Request flow: `pending → approved | rejected`, `approved → purchased`. Every stock change is saved in
`inventory_stock_history`.

## API (all need `Authorization: Bearer <token>`)

| Method & path | Who |
| --- | --- |
| `GET /api/inventory/items` | staff, admin |
| `POST /api/inventory/requests`, `POST /api/inventory/usage`, `GET /api/inventory/usage/mine` | staff |
| `GET /api/inventory/requests/mine` | staff |
| `GET /api/inventory/admin/summary`, `/admin/requests`, `/admin/purchases`, `/admin/history`, `/admin/usage` | admin |
| `POST /api/inventory/admin/requests/:id/decision` | admin |
| `POST /api/inventory/admin/purchases` (body may include `reply`) | admin |
| `POST /api/inventory/admin/items`, `/admin/items/:id/adjust` | admin |

## Tests

```
cd backend
npm test
```

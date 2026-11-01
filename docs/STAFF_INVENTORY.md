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

Request flow: `pending → approved | rejected`, `approved → purchased`. Every stock change is saved in
`inventory_stock_history`.


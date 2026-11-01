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


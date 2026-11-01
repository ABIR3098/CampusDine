# Kitchen Staff login & Inventory

## Run in VS Code

1. Install Node.js 18+ and MySQL (XAMPP / MySQL Server). Create the database once:
   `CREATE DATABASE campusdine;` then import `backend/schema.sql` (phpMyAdmin or `mysql -u root -p campusdine < backend/schema.sql`).
2. Open the `CampusDine` folder in VS Code → **Terminal → New Terminal**.
3. Copy `backend/.env.example` to `backend/.env` and set `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
4. Install and start:
   ```
   cd backend

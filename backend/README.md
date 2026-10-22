# CampusDine Backend

### REST API and Real-Time Communication for CampusDine

CampusDine is an online university canteen management system developed as part of **CSE 3208: Software Development Project I** at Bangladesh University of Professionals (BUP).

The backend provides RESTful APIs and real-time communication to support menu management, food ordering, token tracking, subscription calendar and billing, digital wallet management, and administrative reporting.

The system uses **Node.js, Express.js, MySQL, JSON Web Token (JWT) authentication, and Socket.IO** to support students, teachers, and administrators.

## 1. Key Features

- **Authentication and Authorization:** User registration and login using JWT.
- **Menu Management:** Retrieve menu items and manage prices, availability, and categories.
- **Online Food Ordering:** Place orders, generate order tokens, and view order history.
- **Real-Time Order Tracking:** Receive order-status updates through Socket.IO.
- **Digital Wallet:** Manage wallet balances, top-ups, and transaction history.
- **Subscription Calendar:** Mark meal availability and calculate monthly bills.
- **Admin Dashboard:** Monitor daily orders, revenue, and low-stock items.
- **Revenue Analytics:** View revenue trends and meal-demand forecasts.
- **Database Management:** Store application data in MySQL.
- **Frontend Integration:** Serve the CampusDine frontend through the backend server.

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | REST API development |
| MySQL | Relational database |
| JSON Web Token (JWT) | Authentication and authorization |
| Socket.IO | Real-time communication |
| HTML, CSS, and JavaScript | Frontend |

## 3. Prerequisites

Install the following before running the backend:

- **Node.js v18 or later:** https://nodejs.org/
- **MySQL Server 8.x** or a compatible MariaDB installation through XAMPP.
- **Git:** https://git-scm.com/

For Windows users, XAMPP is a convenient option because it includes MariaDB and phpMyAdmin.

Verify your Node.js installation:

```bash
node -v
npm -v
```

## 4. Database Configuration

CampusDine uses MySQL to store user information, menu items, orders, wallet transactions, subscription details, and other application data.

### Step 1: Create the database

Run the following SQL command in MySQL Workbench, phpMyAdmin, or a MySQL terminal:

```sql
CREATE DATABASE campusdine;
```

### Step 2: Import the schema

From the backend directory, run:

```bash
mysql -u root -p campusdine < schema.sql
```

Enter your MySQL password when prompted. This imports the database structure and any initial data defined in `schema.sql`.

**Note:** If you use XAMPP with an empty root password, adjust the command to match your local configuration.

## 5. Installation

Clone the repository if you have not already done so:

```bash
git clone <repository-url>
```

Navigate to the backend directory:

```bash
cd CampusDine/backend
```

Install the dependencies:

```bash
npm install
```

## 6. Environment Configuration

Create a `.env` file from the example configuration.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the variables required by the project. For example:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=campusdine
JWT_SECRET=your_long_random_secret
PORT=5000
```

**Important:** These variable names are examples. Confirm that they match the names used in the backend code and `.env.example`. Use a strong, randomly generated value for `JWT_SECRET`. Never commit your real `.env` file or expose database credentials in a public repository.

## 7. Running the Backend Server

Make sure the MySQL service is running before starting the server.

### Development mode

```bash
npm run dev
```

Development mode uses Nodemon to restart the server when relevant files change.

### Normal start

```bash
npm start
```

After the server starts successfully, open:

**http://localhost:5000**

The backend serves the CampusDine frontend directly, so a separate frontend development server is not required for the standard local setup.

If demo-account creation is enabled in the current project configuration, the server may also display demo credentials in the terminal.

## 8. API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in and obtain a JWT |

### Menu Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/menu` | Authenticated users | Retrieve menu items |
| POST | `/api/menu` | Admin | Add a menu item |
| PUT | `/api/menu/:id` | Admin | Update menu item details |

### Order Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/orders` | Students and teachers | Place a food order |
| GET | `/api/orders/mine` | Students and teachers | View personal order history |
| GET | `/api/orders` | Admin | View the order queue |
| PATCH | `/api/orders/:id/advance` | Admin | Advance an order's status |

The order status progresses through these stages:

**Received → Cooking → Ready**

Socket.IO broadcasts relevant order events to support real-time updates.

### Wallet Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/wallet` | Retrieve wallet balance and transaction history |
| POST | `/api/wallet/topup` | Add money to the wallet |

### Subscription Calendar and Billing

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/calendar` | Retrieve the current month's calendar |
| PUT | `/api/calendar/:day` | Update a day's meal status |
| GET | `/api/calendar/bill` | Calculate the current month's bill |

### Administration and Reports

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/overview` | Retrieve daily statistics and low-stock information |
| GET | `/api/admin/reports/revenue-trend` | Retrieve the last six months of revenue trends |
| GET | `/api/admin/reports/forecast` | Retrieve the forecast for tomorrow's meal demand |

Protected endpoints require a valid JWT in the `Authorization` header. Administrative endpoints are restricted to authorized administrators.

## 9. Testing the API

You can test the API using Postman, Thunder Client, or a command-line tool.

### Step 1: Register a user

Send a `POST` request to:

```text
http://localhost:5000/api/auth/register
```

Example JSON body:

```json
{
  "name": "Abir Hasan",
  "externalId": "YOUR_TEST_ID",
  "role": "student",
  "password": "your_test_password"
}
```

Use a test account and a non-production password when experimenting with the API.

### Step 2: Log in

Send a `POST` request to:

```text
http://localhost:5000/api/auth/login
```

Example JSON body:

```json
{
  "externalId": "YOUR_TEST_ID",
  "password": "your_test_password"
}
```

A successful response provides an authentication token.

### Step 3: Retrieve the menu

Send a `GET` request to:

```text
http://localhost:5000/api/menu
```

Add this request header:

```text
Authorization: Bearer YOUR_TOKEN
```

Replace `YOUR_TOKEN` with the token returned by the login endpoint.

### Step 4: Place an order

Send a `POST` request to:

```text
http://localhost:5000/api/orders
```

Example JSON body:

```json
{
  "items": [
    {
      "id": 1,
      "qty": 2
    }
  ],
  "paymentMethod": "wallet"
}
```

Include the authentication token and set `Content-Type` to `application/json`. The menu item ID must exist in the database, and the wallet must satisfy the application's payment requirements.

## 10. Frontend Integration

The CampusDine frontend is located at:

```text
../frontend/campusdine.html
```

It communicates with the backend through REST API requests and uses Socket.IO for real-time order updates.

The integration supports:

- User registration and login.
- Menu browsing and food selection.
- Order placement and order history.
- Wallet balance and transaction management.
- Subscription calendar and billing.
- Administrative order management.
- Live order-status notifications.

Start the backend and visit **http://localhost:5000** to access the application locally.

## 11. Deployment

Deployment is planned as a subsequent project phase. Potential hosting options include:

- **Backend:** Render or Railway.
- **Database:** A compatible managed MySQL service.
- **Frontend:** Vercel or Netlify, if deployed separately.

For deployment, configure the required environment variables in the hosting platform and use the appropriate production start command:

```bash
npm start
```

Ensure that the production database is accessible to the backend and that the frontend uses the correct API URL.

### Payment Gateway Integration

The wallet system can be extended to support payment gateways such as SSLCommerz or bKash through their supported sandbox environments. Before enabling real payments, implement payment verification, secure callback handling, transaction validation, and appropriate error handling.

## 12. Project Information

**Project:** CampusDine — Online University Canteen Management System  
**Course:** CSE 3208 — Software Development Project I  
**Institution:** Bangladesh University of Professionals (BUP)  
**Repository:** https://github.com/ABIR3098/CampusDine

---

*Before publishing, verify that the API endpoints, environment variables, demo-account behavior, and deployment instructions match the current codebase.*
# Rider password reset

Riders can use the existing OTP-based Forgot Password flow: request a code with
the rider ID and registered email, then submit the code and a new password.
The reset endpoints allow non-admin accounts, including riders. Configure SMTP
and keep `EMAIL_OTP_REQUIRED=true` to send verification and reset codes by email.

## Rider delivery operations

- **Automatic assignment:** new orders are offered to the least-loaded rider who is on duty, has a recent active GPS location, and has capacity. Admins can retry unassigned orders from the order queue.
- **Shifts and availability:** riders start or end a shift and set a maximum of 1–10 active orders. Assignment requests enforce the shift capacity.
- **Manual assignment:** teachers and admins can select an on-duty rider with available capacity from the rider tracking panel.
- **Route optimization:** a rider can request a nearest-neighbour delivery sequence. It uses checkout coordinates only when the customer grants browser geolocation permission and estimates straight-line distance, not road travel time.
- **Analytics, abuse alerts, and audit history:** admin Reports includes daily order/revenue totals, popular food, busy hours, delivery counts, fraud signals, and recent auditable actions.
- **Group orders:** students and teachers can create a time-limited group, join by code, add food, and let the host load the combined cart into normal checkout. Stock is checked again at checkout.
- **Rider/customer chat:** the order customer and assigned rider can message each other from order tracking or the rider dashboard. Messages are scoped to that order and limited to 1,000 characters.

The server creates or upgrades the operations tables on startup. The matching definitions are also included in `schema.sql` for new installations. Operations endpoints are mounted under `/api/operations`; group orders use `/api/group-orders`, and order chat uses `/api/chat/order/:orderId/messages`.

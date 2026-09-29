# CampusDine Backend - Implementation Guide

**Version:** 2.0.0 Enhanced  
**Last Updated:** September 3, 2026  
**Status:** All features implemented ✓

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Bug Fixes Implemented](#bug-fixes-implemented)
3. [New Features Implemented](#new-features-implemented)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Installation & Deployment](#installation--deployment)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)

---

## Overview

CampusDine is a comprehensive campus food ordering system built with:
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Real-time:** Socket.IO
- **Frontend:** Single HTML/JavaScript SPA
- **Payment:** bKash & Nagad integration
- **Notifications:** SMS alerts

### Project Structure

```
campusdine-project/
├── backend/
│   ├── server-enhanced.js       ← Main server (updated)
│   ├── schema.sql                ← Canonical database schema with all tables
│   ├── package-enhanced.json    ← Dependencies
│   ├── .env.example             ← Environment variables template
│   ├── src/
│   │   ├── db.js               ← Database connection
│   │   ├── middleware/
│   │   │   └── auth.js         ← JWT authentication
│   │   └── routes/
│   │       ├── auth-enhanced.js        ← Auth + OTP password reset
│   │       ├── menu-enhanced.js        ← Search & filter
│   │       ├── orders-enhanced.js      ← Cancellation + CSV export
│   │       ├── wallet-enhanced.js      ← Limits & transactions
│   │       ├── profile.js              ← User profile management
│   │       ├── ratings.js              ← Menu ratings & reviews
│   │       ├── coupon.js               ← Coupon management
│   │       ├── payment.js              ← bKash & Nagad
│   │       ├── notifications.js        ← SMS alerts
│   │       ├── favorites.js            ← Favorites + quick order
│   │       ├── admin.js                ← Admin functions
│   │       └── calendar.js             ← Meal calendar
│   └── frontend/
│       └── campusdine.html      ← Single-page app
```

---

## Bug Fixes Implemented

### 1. **Password Reset Vulnerability** ✓
- **Issue:** Direct password reset without verification
- **Fix:** OTP-based verification system
- **Implementation:** `auth-enhanced.js`
  - `POST /api/auth/request-password-reset` - Generates 6-digit OTP (10min expiry)
  - `POST /api/auth/verify-otp-and-reset` - Verifies OTP before resetting password
  - OTP stored in database with expiry timestamp
  - SMS/Email integration point ready (currently logs to console)

### 2. **Wallet Top-Up Limit** ✓
- **Issue:** No limit on wallet top-up transactions
- **Fix:** Maximum ৳9,999 per transaction enforced
- **Implementation:** `wallet-enhanced.js`
  - Validation: `POST /api/wallet/topup`
  - Limit stored in `.env` as `MAX_WALLET_TOPUP=9999`

### 3. **Missing Rate Limiting** ✓
- **Issue:** No protection against brute force attacks
- **Fix:** Multi-layer rate limiting
- **Implementation:** `server-enhanced.js`
  - General: 100 requests/15 minutes
  - Auth: 5 login attempts/15 minutes
  - Password reset: 3 attempts/hour
  - Wallet: 10 operations/hour

### 4. **Past-Date Meal Marking** ✓
- **Issue:** Users could order meals for past dates
- **Fix:** Server-side validation
- **Implementation:** `orders-enhanced.js`
  - POST `/api/orders` validates `meal_date >= today`
  - Rejects orders with dates in the past

### 5. **Order Token Collision Risk** ✓
- **Issue:** Non-unique order tokens could cause conflicts
- **Fix:** UUID v4 generation for order tokens
- **Implementation:** `orders-enhanced.js`
  - Uses `uuid.v4()` for token generation
  - Database schema updated to use `VARCHAR(36)` with UNIQUE constraint

---

## New Features Implemented

### 1. **Order Cancellation & Wallet Refund** ✓
**Endpoint:** `POST /api/orders/:orderId/cancel`
- Only cancels orders with status "Received"
- Automatically refunds full amount to wallet
- Uses database transactions to ensure consistency
- Logs refund transaction

### 2. **CSV Order History Export** ✓
**Endpoint:** `GET /api/orders/export/csv`
- Exports all user's orders as CSV
- Columns: Order ID, Token, Date, Status, Items, Amount
- Browser automatically downloads file

### 3. **User Profile Management** ✓
**Endpoints:**
- `GET /api/profile` - View profile
- `PUT /api/profile` - Update name, email, phone
- `POST /api/profile/change-password` - Update password
- `GET /api/profile/stats` - Order stats & metrics

### 4. **Menu Rating & Review System** ✓
**Endpoints:**
- `POST /api/ratings/:menuItemId` - Submit 1-5 star rating + review (500 chars max)
- `GET /api/ratings/:menuItemId` - View all ratings + average
- `GET /api/ratings/:menuItemId/my-rating` - Current user's rating
- `DELETE /api/ratings/:ratingId` - Delete own rating
- `GET /api/ratings/top/items` - Top 10 rated items

### 5. **Online Payment Gateway** ✓
**bKash Integration:**
- `POST /api/payment/bkash/initiate` - Start bKash payment
- `POST /api/payment/bkash/callback` - Handle payment confirmation

**Nagad Integration:**
- `POST /api/payment/nagad/initiate` - Start Nagad payment
- `POST /api/payment/nagad/callback` - Handle payment confirmation

**Features:**
- Payment receiving number: `01318400442`
- Sandbox mode for testing (set in `.env`)
- Transaction logging and status tracking

### 6. **SMS Notifications** ✓
**Endpoints:**
- `POST /api/notifications/subscribe` - Enable SMS alerts
- `POST /api/notifications/unsubscribe` - Disable alerts
- `POST /api/notifications/test` - Send test SMS
- `GET /api/notifications/history` - View notification log

**Status Updates:**
- Order Received
- Order Confirmed
- Order Preparing
- Order Ready
- Order Delivered
- Order Cancelled

**Integration:** Ready for Twilio, AWS SNS, or local SMS gateway

### 7. **Coupon & Discount System** ✓
**Endpoints:**
- `POST /api/coupons/validate` - Check coupon validity
- `POST /api/coupons/apply` - Apply coupon to order
- `GET /api/coupons/available` - List active coupons
- `POST /api/coupons` (Admin) - Create coupon
- `PUT /api/coupons/:couponId` (Admin) - Update coupon

**Coupon Features:**
- Percentage or fixed amount discounts
- Minimum order requirement
- Maximum discount cap
- Usage limit per coupon
- Expiry date support

### 8. **Favorites System** ✓
**Endpoints:**
- `POST /api/favorites/:menuItemId` - Add to favorites
- `DELETE /api/favorites/:menuItemId` - Remove from favorites
- `GET /api/favorites` - View all favorites
- `GET /api/favorites/:menuItemId/is-favorite` - Check status
- `GET /api/favorites/trending/items` - Most favorited items
- `POST /api/favorites/:menuItemId/quick-order` - Quick order from favorites

### 9. **Advanced Search & Filter** ✓
**Endpoints:**
- `GET /api/menu?search=...&category=...&minPrice=...&maxPrice=...&minRating=...`
- `GET /api/menu/categories/list` - Available categories
- `GET /api/menu/stats/price-range` - Price statistics
- `GET /api/menu/top/rated` - Top rated items
- `POST /api/menu/search` - Advanced search with multiple filters

**Filter Options:**
- Text search (name, description)
- Category
- Price range
- Minimum rating
- Availability
- Sort by: price, rating, favorites, newest

---

## Database Setup

### 1. **Create Database**

```sql
CREATE DATABASE campusdine;
USE campusdine;
```

### 2. **Run Schema**

```bash
# Apply the canonical schema file
mysql -u root -p campusdine < schema.sql
```

### 3. **Schema Highlights**

**New Tables Added:**
- `menu_ratings` - User ratings and reviews
- `coupons` - Discount codes
- `coupon_usage` - Coupon usage tracking
- `payment_transactions` - Payment history
- `user_favorites` - Favorite items
- `notification_log` - SMS/Email notification history

**Enhanced Columns:**
- `users.reset_otp` - For password reset
- `users.reset_otp_expiry` - OTP expiration
- `users.notifications_enabled` - SMS preference
- `orders.order_token` - UUID token (changed)
- `orders.discount_amount` - For coupons
- `orders.discount_applied` - Coupon flag

---

## Environment Configuration

### 1. **Copy Template**

```bash
cp .env.example .env
```

### 2. **Critical Variables**

```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=campusdine

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRY=7d

# Payment - bKash
BKASH_APP_KEY=your-key
BKASH_APP_SECRET=your-secret
BKASH_SANDBOX_MODE=true

# Payment - Nagad
NAGAD_MERCHANT_ID=your-id
NAGAD_MERCHANT_KEY=your-key

# SMS - Twilio (Optional)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890

# App URLs
APP_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5000

# Limits
MAX_WALLET_TOPUP=9999
```

---

## Installation & Deployment

### 1. **Prerequisites**

- Node.js 14+ and npm 6+
- MySQL 5.7+
- Git

### 2. **Install Dependencies**

```bash
cd backend
npm install --save-dev nodemon
npm install express cors bcrypt jsonwebtoken mysql2 socket.io uuid express-rate-limit dotenv
```

### 3. **Or Use Enhanced Package**

```bash
cp package-enhanced.json package.json
npm install
```

### 4. **Run Server**

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

### 5. **Verify Server**

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2026-09-03T...",
  "uptime": 123.45
}
```

---

## API Endpoints Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login & get JWT |
| GET | `/api/auth/verify` | ✅ | Verify token |
| POST | `/api/auth/request-password-reset` | ❌ | Request OTP |
| POST | `/api/auth/verify-otp-and-reset` | ❌ | Verify OTP & reset |

### Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/profile` | ✅ | View profile |
| PUT | `/api/profile` | ✅ | Update profile |
| POST | `/api/profile/change-password` | ✅ | Change password |
| GET | `/api/profile/stats` | ✅ | User statistics |

### Menu

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/menu` | ❌ | List items with filters |
| GET | `/api/menu/:id` | ❌ | Get item details |
| GET | `/api/menu/categories/list` | ❌ | List categories |
| GET | `/api/menu/stats/price-range` | ❌ | Price stats |
| GET | `/api/menu/top/rated` | ❌ | Top rated items |
| POST | `/api/menu/search` | ❌ | Advanced search |

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | ✅ | Create order |
| GET | `/api/orders` | ✅ | List user orders |
| GET | `/api/orders/:id` | ✅ | Get order details |
| POST | `/api/orders/:id/cancel` | ✅ | Cancel order |
| GET | `/api/orders/export/csv` | ✅ | Export CSV |
| PUT | `/api/orders/:id/status` | ✅ (Admin) | Update status |

### Wallet

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/wallet/balance` | ✅ | Check balance |
| GET | `/api/wallet/transactions` | ✅ | Transaction history |
| POST | `/api/wallet/topup` | ✅ | Top-up wallet |
| POST | `/api/wallet/deduct` | ✅ (Admin) | Deduct amount |
| POST | `/api/wallet/refund` | ✅ (Admin) | Process refund |

### Ratings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/ratings/:menuItemId` | ✅ | Submit rating |
| GET | `/api/ratings/:menuItemId` | ❌ | Get all ratings |
| GET | `/api/ratings/:menuItemId/my-rating` | ✅ | Get own rating |
| DELETE | `/api/ratings/:ratingId` | ✅ | Delete rating |
| GET | `/api/ratings/top/items` | ❌ | Top rated items |

### Coupons

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/coupons/validate` | ✅ | Validate coupon |
| POST | `/api/coupons/apply` | ✅ | Apply coupon |
| GET | `/api/coupons/available` | ❌ | List active coupons |
| POST | `/api/coupons` | ✅ (Admin) | Create coupon |
| PUT | `/api/coupons/:id` | ✅ (Admin) | Update coupon |

### Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payment/bkash/initiate` | ✅ | Start bKash payment |
| POST | `/api/payment/bkash/callback` | ❌ | bKash callback |
| POST | `/api/payment/nagad/initiate` | ✅ | Start Nagad payment |
| POST | `/api/payment/nagad/callback` | ❌ | Nagad callback |
| GET | `/api/payment/history` | ✅ | Payment history |
| GET | `/api/payment/:transactionId` | ✅ | Transaction details |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/notifications/subscribe` | ✅ | Enable SMS |
| POST | `/api/notifications/unsubscribe` | ✅ | Disable SMS |
| GET | `/api/notifications/preferences` | ✅ | Get preferences |
| POST | `/api/notifications/test` | ✅ | Send test SMS |
| GET | `/api/notifications/history` | ✅ | View history |

### Favorites

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/favorites/:menuItemId` | ✅ | Add favorite |
| DELETE | `/api/favorites/:menuItemId` | ✅ | Remove favorite |
| GET | `/api/favorites` | ✅ | List favorites |
| GET | `/api/favorites/:menuItemId/is-favorite` | ✅ | Check status |
| GET | `/api/favorites/trending/items` | ❌ | Trending items |
| POST | `/api/favorites/:menuItemId/quick-order` | ✅ | Quick order |

---

## Testing Guide

### 1. **Manual Testing with cURL**

**Register User:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "external_id": "CSE2021001",
    "email": "john@campus.edu",
    "password": "password123"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "CSE2021001",
    "password": "password123"
  }'
```

Save the token from response.

**Request Password Reset:**
```bash
curl -X POST http://localhost:5000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email": "john@campus.edu"}'
```

Check console for OTP.

**Verify OTP & Reset:**
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp-and-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@campus.edu",
    "otp": "123456",
    "newPassword": "newpassword123"
  }'
```

**Get User Profile (with Auth):**
```bash
curl -X GET http://localhost:5000/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 2. **Database Testing**

**Check Users:**
```sql
SELECT id, name, external_id, role, wallet_balance FROM users;
```

**Check Orders:**
```sql
SELECT o.id, o.order_token, u.name, o.status, o.total_amount, o.meal_date 
FROM orders o 
JOIN users u ON o.user_id = u.id;
```

**Check Ratings:**
```sql
SELECT mr.id, u.name, mi.name, mr.rating, mr.review 
FROM menu_ratings mr 
JOIN users u ON mr.user_id = u.id 
JOIN menu_items mi ON mr.menu_item_id = mi.id;
```

### 3. **Rate Limiting Test**

Test auth rate limiting with rapid login attempts:
```bash
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"external_id": "test", "password": "wrong"}' &
done
wait
```

After 5 attempts, should receive rate limit error.

---

## Troubleshooting

### Common Issues

**1. Database Connection Fails**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
- Check MySQL is running: `sudo systemctl start mysql`
- Verify credentials in `.env`
- Ensure database exists: `mysql -u root -p campusdine`

**2. JWT Secret Not Set**
```
Error: JWT_SECRET must be defined
```
- Add to `.env`: `JWT_SECRET=your-secret-key-32-chars-min`

**3. Port Already in Use**
```
Error: listen EADDRINUSE :::5000
```
- Change PORT in `.env` or kill process: `lsof -i :5000`

**4. CORS Issues**
```
Error: CORS policy blocked
```
- Add frontend URL to `.env`: `CORS_ORIGIN=http://localhost:3000`
- Or set to `*` for development

**5. Rate Limiting Too Strict**
- Adjust in `.env`:
  ```
  RATE_LIMIT_WINDOW_MS=900000
  RATE_LIMIT_MAX_REQUESTS=100
  ```

### Logs & Debugging

**Enable verbose logging:**
```bash
NODE_ENV=development npm run dev
```

**Common Log Messages:**
- `[Socket.IO] User connected` - Real-time connection active
- `[OTP] User: ...` - Password reset OTP generated
- `[SMS] To: ...` - SMS notification (development log)
- `Error:` - Check stack trace for details

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Change `JWT_SECRET` to strong random string
- [ ] Set `BKASH_SANDBOX_MODE=false` for real payments
- [ ] Configure SMS service (Twilio, AWS SNS)
- [ ] Enable HTTPS (`ENABLE_HTTPS=true`)
- [ ] Set up SSL certificates
- [ ] Configure database backups
- [ ] Monitor server logs
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure CDN for static files
- [ ] Set up rate limiting alerts
- [ ] Test all payment flows

---

## Support & Contact

For issues or questions:
1. Check error logs in console
2. Review this guide's troubleshooting section
3. Verify `.env` configuration
4. Check database integrity
5. Review API endpoint examples

---

**Last Updated:** September 3, 2026  
**Version:** 2.0.0 Enhanced  
**All Features:** ✅ Complete

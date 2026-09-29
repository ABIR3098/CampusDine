# CampusDine Quick Start Guide

Get your enhanced CampusDine server running in 5 minutes!

## ⚡ Quick Setup (5 minutes)

### Step 1: Database Setup (2 min)

```bash
# Start MySQL
sudo systemctl start mysql

# Login and create database
mysql -u root -p
```

```sql
CREATE DATABASE campusdine;
USE campusdine;
SOURCE schema.sql;
EXIT;
```

### Step 2: Environment Setup (1 min)

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:
```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your-super-secret-key-change-this
```

### Step 3: Install & Run (2 min)

```bash
# Install dependencies
npm install

# Or use enhanced package
cp package-enhanced.json package.json
npm install

# Start server
npm run dev
```

✅ Server running at `http://localhost:5000`

---

## 🧪 Instant Test (30 seconds)

**In another terminal:**

```bash
# Test server health
curl http://localhost:5000/health

# Expected output:
# {"status":"OK","timestamp":"...","uptime":...}
```

---

## 📱 Test API Endpoints

### 1. Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "external_id": "CSE2021001",
    "email": "test@campus.edu",
    "password": "test123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "CSE2021001",
    "password": "test123"
  }'
```

**Save the token from response as `TOKEN=...`**

### 3. Get Menu
```bash
curl "http://localhost:5000/api/menu"

# With filters:
curl "http://localhost:5000/api/menu?category=Lunch&minPrice=100&maxPrice=200&sortBy=rating"
```

### 4. Search Menu
```bash
curl -X POST http://localhost:5000/api/menu/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "biryani",
    "filters": {
      "minPrice": 100,
      "maxPrice": 200,
      "categories": ["Lunch"]
    }
  }'
```

### 5. Get Profile (with auth)
```bash
TOKEN="your_token_here"
curl -X GET http://localhost:5000/api/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Create Order
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "meal_date": "2026-09-05",
    "items": [
      {"menu_item_id": 1, "quantity": 2}
    ]
  }'
```

### 7. Rate Menu Item
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/ratings/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "rating": 5,
    "review": "Excellent biryani! Highly recommended."
  }'
```

### 8. View Ratings
```bash
curl http://localhost:5000/api/ratings/1
```

### 9. Add to Favorites
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/favorites/1 \
  -H "Authorization: Bearer $TOKEN"
```

### 10. Get Favorites
```bash
TOKEN="your_token_here"
curl http://localhost:5000/api/favorites \
  -H "Authorization: Bearer $TOKEN"
```

### 11. Export Orders as CSV
```bash
TOKEN="your_token_here"
curl http://localhost:5000/api/orders/export/csv \
  -H "Authorization: Bearer $TOKEN" \
  -o orders.csv
```

### 12. Request Password Reset
```bash
curl -X POST http://localhost:5000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email": "test@campus.edu"}'

# Check console for OTP (format: 6-digit number)
```

### 13. Verify OTP & Reset Password
```bash
OTP="123456"  # From console
curl -X POST http://localhost:5000/api/auth/verify-otp-and-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@campus.edu",
    "otp": "'$OTP'",
    "newPassword": "newpassword123"
  }'
```

### 14. Get Wallet Balance
```bash
TOKEN="your_token_here"
curl http://localhost:5000/api/wallet/balance \
  -H "Authorization: Bearer $TOKEN"
```

### 15. Top-up Wallet
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/wallet/topup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 500}'

# Note: Max is 9999 per transaction
```

### 16. Get Coupons
```bash
curl http://localhost:5000/api/coupons/available
```

### 17. Validate Coupon
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/coupons/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "coupon_code": "CAMPUS10",
    "order_total": 500
  }'
```

### 18. Initiate Payment (bKash)
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/payment/bkash/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 1500,
    "orderId": 1
  }'
```

### 19. Enable SMS Notifications
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/notifications/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumber": "01718123456"}'
```

### 20. Send Test SMS
```bash
TOKEN="your_token_here"
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer $TOKEN"

# Check console for SMS log
```

---

## 📊 Database Verification

Check if data was created:

```sql
mysql -u root -p campusdine

-- View users
SELECT id, name, external_id, role, wallet_balance FROM users;

-- View menu items
SELECT id, name, price, category FROM menu_items LIMIT 10;

-- View orders
SELECT o.id, o.order_token, u.name, o.status, o.total_amount 
FROM orders o 
JOIN users u ON o.user_id = u.id;

-- View ratings
SELECT mr.id, u.name, mi.name, mr.rating 
FROM menu_ratings mr 
JOIN users u ON mr.user_id = u.id 
JOIN menu_items mi ON mr.menu_item_id = mi.id;

-- View favorites
SELECT uf.id, u.name, mi.name 
FROM user_favorites uf 
JOIN users u ON uf.user_id = u.id 
JOIN menu_items mi ON uf.menu_item_id = mi.id;
```

---

## 🎯 Key Features to Test

✅ **Rate Limiting:** Try logging in 6 times rapidly (5 allowed)  
✅ **Wallet Limit:** Try topping up 10,000 (max 9,999)  
✅ **Past Dates:** Try ordering for yesterday (rejected)  
✅ **Order Cancellation:** Create order, then cancel (must have status "Received")  
✅ **CSV Export:** Export orders, open in Excel  
✅ **OTP Reset:** Request reset, verify with OTP  
✅ **Search & Filter:** Try menu search with multiple filters  
✅ **Ratings:** Add 5-star rating, view average rating  
✅ **Favorites:** Add/remove items, check trending  
✅ **Coupons:** Apply "CAMPUS10" (10% off, min ৳100)  

---

## 🔧 Troubleshooting

**"connect ECONNREFUSED"**
```bash
sudo systemctl start mysql
```

**"JWT_SECRET not defined"**
```bash
# Edit .env and add:
JWT_SECRET=your-secret-key-32-chars-minimum
```

**"Port 5000 already in use"**
```bash
# Kill process or change port in .env:
lsof -i :5000
kill -9 <PID>
```

**"Cannot find module"**
```bash
npm install
```

---

## 📝 Next Steps

1. ✅ Database set up
2. ✅ API running and tested
3. ⬜ **Frontend:** Open `frontend/campusdine.html` in browser
4. ⬜ **Production:** See IMPLEMENTATION_GUIDE.md for deploy checklist
5. ⬜ **Payments:** Configure bKash/Nagad credentials in `.env`
6. ⬜ **SMS:** Set up Twilio in `.env`

---

## 📚 Full Documentation

See `IMPLEMENTATION_GUIDE.md` for:
- Detailed API documentation
- Environment variables
- Payment integration
- SMS configuration
- Production deployment
- Troubleshooting

---

## ⚡ Performance Tips

- Enable caching for menu items
- Use connection pooling (already done in `db.js`)
- Monitor rate limiting alerts
- Regular database backups
- Clean up old payment transactions

---

**Ready to go!** 🚀

Any issues? Check the error logs in terminal.

# CampusDine (বাংলা পরিচিতি)

BUP · CSE 3208 Software Development Project I

CampusDine একটি ক্যাম্পাস ক্যান্টিন ও হল-মিলের ওয়েব অ্যাপ। একটাই সার্ভার (Node.js + Express + Socket.IO) API চালায় এবং ফ্রন্টএন্ড পরিবেশন করে, ডাটাবেস MySQL। আলাদা ফ্রন্টএন্ড সার্ভার লাগে না।

পুরো ইংরেজি বিবরণ [README.md](README.md) ফাইলে আছে। বাকি নথি [docs/](docs/README.md) ফোল্ডারে।

## রেস্টুরেন্ট ও ব্যবহারকারী

চারটি রেস্টুরেন্ট আছে: **Amitié (Friendship)**, **Vista Cafeteria**, **Third Place** এবং **Staff Canteen**। লগইনের পর প্রথমে একটি রেস্টুরেন্ট বেছে নিতে হয়, তারপর শুধু সেই রেস্টুরেন্টের মেনু দেখা যায়। একটি অর্ডারে একটি রেস্টুরেন্টের খাবারই থাকতে পারে।

ব্যবহারকারীর ধরন:
- **student ও teacher**: মেনু দেখা, অর্ডার, ওয়ালেট, মিল ক্যালেন্ডার, গ্রুপ অর্ডার
- **admin**: মেনু ও দাম বদলানো, অর্ডার এগিয়ে নেওয়া, রিপোর্ট
- **rider**: ডেলিভারি নেওয়া (শুধু teacher-এর অর্ডারে রাইডার ডেলিভারি পাওয়া যায়); Rider hub-এর "Canteen admin chat" ট্যাব থেকে ক্যান্টিন অ্যাডমিনকে মেসেজ করতে পারে; "Teacher chat" ট্যাব থেকে teacher-এর সাথে সরাসরি চ্যাট করতে পারে (teacher নিজে "Rider chat" ট্যাবে যেকোনো রাইডারকে লিখতে পারেন)
- **hall_admin**: হল ব্যবস্থাপনা (Hall Admin)

## চালানোর ধাপ

1. **Node.js** (v18 বা নতুন) এবং **MySQL** (অথবা XAMPP) ইনস্টল করুন। `node -v` দিয়ে দেখে নিন।
2. MySQL চালু করে `campusdine` নামে একটি ডাটাবেস বানান (collation `utf8mb4_general_ci`)।
3. phpMyAdmin-এর **Import** ট্যাবে `backend/schema.sql` ইমপোর্ট করুন। কমান্ড লাইনে চাইলে:
   `mysql -u root -p campusdine < backend/schema.sql`
4. কনফিগারেশন ফাইল বানান:
   ```
   cd backend
   cp .env.example .env
   ```
   XAMPP-এর ডিফল্টে `DB_USER=root` ও খালি `DB_PASSWORD` ঠিকই থাকে। `JWT_SECRET`-এ একটি লম্বা এলোমেলো লেখা দিন।
5. ইনস্টল করে চালান:
   ```
   npm install
   npm run dev
   ```
6. ব্রাউজারে **http://localhost:5000** খুলুন।

টার্মিনালটি ব্যবহারের পুরো সময় চালু রাখতে হবে।

## ডেমো অ্যাকাউন্ট

প্রথমবার ডাটাবেসে যুক্ত হলে সার্ভার নিজেই চারটি অ্যাকাউন্ট বানায়:

| ভূমিকা | ID | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Student | `student1` | `student123` |
| Teacher | `teacher1` | `teacher123` |
| Rider | `rider1` | `rider123` |

এগুলো শুধু পরীক্ষার জন্য। আসল সার্ভারে `NODE_ENV=production` দিলে ডেমো অ্যাকাউন্ট তৈরি হয় না।

## সমস্যা হলে

- **`npm run dev` ❌ দেখিয়ে বন্ধ হয়ে যায়**: ঠিক নিচের 👉 লাইনটি পড়ুন। সেখানে বলা থাকে MySQL চালু করতে হবে, `schema.sql` ইমপোর্ট করতে হবে, নাকি `.env` ঠিক করতে হবে।
- **`Cannot GET /`**: ঠিকানা ভুল। অ্যাপ `http://localhost:5000` এ চলে।
- **লগইন হয় না**: ডেমো অ্যাকাউন্টের ID ও পাসওয়ার্ড উপরের তালিকার সাথে মিলিয়ে নিন, আর সার্ভার টার্মিনালে ডাটাবেসের ত্রুটি আছে কিনা দেখুন।
- **নতুন খাবার মেনুতে আসে না**: `backend/more_menu_items.sql` ইমপোর্ট করেছেন কিনা দেখুন ([docs/MENU_ITEMS_SQL.md](docs/MENU_ITEMS_SQL.md))।

## টেস্ট চালানো

ডাটাবেস ছাড়াই চলে এমন টেস্ট `backend` ফোল্ডারে আছে:

```
cd backend
npm install
node --test
```

প্রতিটি টেস্ট ফাইল `backend/tests/` ফোল্ডারে। সব টেস্ট পাস করলে শেষে `# fail 0` দেখাবে।

নতুন খাবার যোগ করার নিয়ম আছে [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) ফাইলে।

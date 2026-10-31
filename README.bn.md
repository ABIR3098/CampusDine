# CampusDine (বাংলা পরিচিতি)

BUP · CSE 3208 Software Development Project I

CampusDine একটি ক্যাম্পাস ক্যান্টিন ও হল-মিলের ওয়েব অ্যাপ। একটাই সার্ভার (Node.js + Express + Socket.IO) API চালায় এবং ফ্রন্টএন্ড পরিবেশন করে, ডাটাবেস MySQL। আলাদা ফ্রন্টএন্ড সার্ভার লাগে না।

পুরো ইংরেজি বিবরণ [README.md](README.md) ফাইলে আছে। বাকি নথি [docs/](docs/README.md) ফোল্ডারে।

## রেস্টুরেন্ট ও ব্যবহারকারী

চারটি রেস্টুরেন্ট আছে: **Amitié (Friendship)**, **Vista Cafeteria**, **Third Place** এবং **Staff Canteen**। লগইনের পর প্রথমে একটি রেস্টুরেন্ট বেছে নিতে হয়, তারপর শুধু সেই রেস্টুরেন্টের মেনু দেখা যায়। একটি অর্ডারে একটি রেস্টুরেন্টের খাবারই থাকতে পারে।

ব্যবহারকারীর ধরন:
- **student ও teacher**: মেনু দেখা, অর্ডার, ওয়ালেট, মিল ক্যালেন্ডার, গ্রুপ অর্ডার
- **admin**: মেনু ও দাম বদলানো, অর্ডার এগিয়ে নেওয়া, রিপোর্ট
- **rider**: ডেলিভারি নেওয়া (শুধু teacher-এর অর্ডারে রাইডার ডেলিভারি পাওয়া যায়)
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

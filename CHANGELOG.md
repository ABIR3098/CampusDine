# CampusDine v2.2.1 — new look

Pure visual redesign (no behaviour changes). The mint-and-gold "royal" theme is gone.

- **Identity:** Dhaka yellow-cab yellow + deep navy, with chili-red and leaf-green only for meaning (full / quiet / cancel / success). Flat surfaces — no gradients, glass or hover-lift.
- **The one bold shape:** the meal **token** — a perforated yellow ticket on Track Order, Wallet/Reports and the landing page. Primary buttons are yellow with a pressed-key edge.
- **Type:** Bricolage Grotesque for headings, prices and tokens; Hind Siliguri for body text, so Bangla and English share the same weight and colour.
- **Navigation:** navy top bar with a yellow rule; on phones the tabs become one swipeable strip.
- **Landing page:** left-aligned hero with a sample token, copy updated to match what the app really does today (slots, QR pickup, group orders, budget).
- **Fixes found while reviewing:** Bangla item names are now safe even if the database/client isn't utf8mb4 (`schema.sql` sets it, the connection uses utf8mb4, and the server warns if the database charset is wrong); long pickup-slot lists scroll instead of filling the page; chart bars and table headers have readable contrast.
- Everything is still one file: `frontend/campusdine.html`. Colours live in `:root` at the top of its `<style>`; the Tailwind colour names are remapped in the `tailwind.config` script just above it.

---

# CampusDine v2.2 — 13 new features

| # | Feature | Where to find it |
|---|---------|------------------|
| 1 | **Pickup time slots + live rush meter** — 10-minute slots with a capacity; green/yellow/orange/red shows how busy each is, full slots can't be booked, cancelling frees the slot. Refund tiers now count from your *slot* time. | Menu & Order (student) · Overview "Rush Meter" (admin) |
| 2 | **Class-timetable-aware ordering** — save lectures once; slots that clash (with a 5-min walking buffer) get a 📚 mark and the menu suggests "You're free at 1:10 — order for 1:10". | Calendar & Classes |
| 3 | **Last-hour surplus deals** — in the last N minutes before closing, today's meals are auto-discounted (default 30% for the last 45 min). Shows strike-through prices, "you saved ৳X", and a community "meals saved from waste" counter. Per-item opt-out. | Menu · My Stats · Admin Settings/Menu |
| 4 | **Group orders / split bill** — one shared cart and one pickup; split equally or "everyone pays own items". Everyone must confirm; payment is atomic across all wallets (if one member is short, nothing is charged). Refunds go back to each payer. | Friends |
| 5 | **Treat a friend** — send wallet credit, or buy them a meal (they collect it; if they decline, *you* are refunded). | Friends |
| 6 | **QR pickup** — every order has a QR; admin scans it (camera on Chrome/Edge, or a USB scanner, or types the 8-char code) to hand over the food. Tracks real pickup time and wait. | Track Order · admin Pickup |
| 7 | **Ramadan & Jummah mode** — iftar-only menu items + iftar pickup slots (60→10 min before Maghrib); Fridays pause for Jummah with extra capacity before/after. | Admin Settings |
| 8 | **Meal streaks & rewards** — points for every collected meal, streak bonuses + milestones (5/10/20 days), Fri/Sat never break a streak; redeem points for private single-use coupons. | My Stats |
| 9 | **Dietary & spice tags** — veg / halal / nuts / spice level, menu filters (Vegetarian, No nuts, Mild). | Menu · admin Menu "Tags" |
| 10 | **Queue position + ETA** — "3 orders ahead of you · ~9 min", updated live. | Track Order |
| 11 | **Bangla / English toggle + voice search** — one click ("বাং"/"EN"), remembered; 🎤 voice search in Bangla or English (Chrome/Edge). | Top bar · Menu |
| 12 | **Cook plan (demand prediction)** — per-item "how much to cook" for any day from same-weekday history (recent weeks weigh more), pre-orders and the meal-calendar signal, +10% safety margin. | Admin Reports |
| 13 | **Weekly budget tracker** — set a limit; live warnings in the cart, notifications at 80% and 100%, 7-day chart, category split, last-week comparison. | My Stats · Menu cart |

## Admin settings (new screen)
Opening hours, slot capacity, kitchen minutes/order, Ramadan mode + Maghrib time, Jummah window, last-hour deal %.

## Upgrade
`cd backend && npm install` (adds `qrcode`), then `npm start` — the database upgrades itself (new tables/columns, iftar menu items and dietary tags are seeded once).

## Notes / limits
- Camera QR scanning and voice search use browser APIs (Chrome / Edge / Android Chrome). Everywhere else, type the 8-character code / type the search.
- Bangla covers the main screens and buttons; a few admin-only labels stay English.
- bKash/Nagad are still adapter stubs (see v2.1 notes). Points are awarded when the admin marks the meal **collected**.
- `npm test` runs 160+ checks (needs MySQL + the same `.env`); set `LOGIN_LIMIT` / `REGISTER_LIMIT` high when running it repeatedly.

---

# CampusDine v2.1 — bug fixes & new features (previous release)

## Bugs fixed
**Crashes / reliability**
- One bad request (e.g. `/api/calendar?month=abc`, an invalid coupon, a bad menu POST) used to crash the whole server. All async errors now return a clean 4xx/5xx.
- DB connection leaks in profile/ratings/favorites/notifications/coupons (pool exhausted after ~10 errors) — routes no longer hold connections.
- Invalid JSON body now returns 400 instead of 500.

**Orders / money**
- Advancing an order past **Ready** turned it into **Cancelled**. Now rejected (409).
- Coupons: order total was discounted, then the frontend tried to apply the coupon again (always failed / could double-discount). The coupon is now applied once, atomically, inside `POST /api/orders`; preview and charge use the same maths.
- Cancelling refunded **0%** for orders made for today (timezone bug). Refund windows now use Dhaka time (`APP_TZ_OFFSET`).
- Cancelling now restores stock and releases the coupon; cash/unpaid orders no longer "refund" money that was never taken.
- Cancelled cash orders no longer count as revenue; refunds are subtracted.
- Double-click / retry could create two orders — `Idempotency-Key` is now sent by the frontend.
- Quick-order from Favorites ignored stock and didn't lock the wallet (could go negative / oversell). Fixed.
- Can't order archived items, more than 20 of one item, or a meal date >30 days ahead.

**Security**
- bKash/Nagad payment amount now comes from the order in the DB (was client-supplied); order must belong to the caller.
- Nagad callback was unauthenticated (anyone could mark an order paid) — now needs a valid signature.
- Password-reset OTP is stored hashed, expires, and locks after 5 wrong tries; it is never returned by the API unless `EXPOSE_DEV_OTP=true`.
- Login timing no longer reveals whether an ID exists; ratings only for items you actually ordered (whole numbers 1-5); menu/coupon input validated; CSV export protected against formula injection; security headers; stricter rate limits on login/register/reset.
- Demo accounts and free demo top-up are disabled in production (`NODE_ENV=production`, `ALLOW_DEMO_TOPUP=false`).

**Frontend**
- Refreshing the page logged you out — session now restored.
- Expired token now logs out cleanly. Hard-coded receiving phone number moved to `.env` (`/api/config`).
- Calendar: past days can't be edited; day parsing no longer shifts by a day.
- Coupon is cleared when the cart changes; cart quantity capped by stock; sold-out favourites disabled.
- Order tokens shortened for display; ratings only offered once an order is Ready.

**Housekeeping**
- `schema.sql` is now re-runnable (previously duplicated the menu each run); old databases **auto-upgrade** on server start.
- Removed dead duplicate `*-enhanced` files (moved to `backend/_legacy`) and a stray junk file.

## New features
- 🔔 **Live notification bell** for students (order status pushed over WebSocket + saved history + unread badge) and toast pop-ups.
- 👨‍🍳 **Admin**: cancel any order with full refund; order filters (Active/Ready/Cancelled/Refunded); **Coupons tab** (create, enable/disable); archive/restore menu items; **live new-order and low-stock/sold-out alerts**; 7-day chart; top sellers; **export all orders to CSV**.
- 🔁 **Order again** button on past orders.
- ⭐ Menu shows average rating and "Only N left" warnings.
- 📊 Profile stats endpoint (orders, spend, most-ordered item).
- ⚙️ `/api/config`, `/api/auth/me`, `/api/coupons/available`, `npm test` (64 automated checks).

## Upgrade
1. `cd backend && npm install`
2. Start MySQL, then `npm start` — the database upgrades itself.
3. (Optional) see the new options at the bottom of `.env.example`.

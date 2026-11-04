# Backend modules

Shared helper modules in `backend/src/` and what each one exports. Route files are listed separately in [API routes](API_ROUTES.md).

## `src/catalog.js`
Menu catalogue: image for every item (served locally from frontend/images/food, so nothing is loaded from the internet) and the extra items added in v2.

Exports: `IMAGE_BY_NAME`, `NEW_ITEMS`, `NUTRITION_BY_NAME`, `nutritionFor`, `RESTAURANTS`, `DEFAULT_RESTAURANT`, `ITEMS_BY_RESTAURANT`, `restaurantOf`, `isRestaurantId`, `menuRank`

## `src/db.js`
Exports: `pool`

## `src/hall/advanced.js`
Exports: `router`, `notify`

## `src/hall/advancedSchema.js`
Extended Hall module schema. Idempotent: safe to run at each server start.

Exports: `ensureHallAdvancedSchema`

## `src/hall/autopay.js`
Auto-pay: for people who turned it on, the previous month's Hall bill is taken from their wallet between the 1st and the GRACE_DAYS-th of every month (all meals of that month have closed by then).

Exports: `GRACE_DAYS`, `previousMonth`, `autoPayOne`, `runAutoPay`, `startAutoPay`

## `src/hall/autopaySchema.js`
Auto-pay: who turned it on, and what happened each time it ran.

Exports: `ensureHallAutoPaySchema`

## `src/hall/dietSchema.js`
Diet preferences: what a person doesn't eat and what they are allergic to.

Exports: `ensureHallDietSchema`

## `src/hall/dietTags.js`
What is in a meal? The menu is plain text ("Rice, Dal, Beef curry"), so the tags are found by looking for well-known words (English and Bangla/Banglish). It is a helper, not a guarantee: the screens say so.

Exports: `TAGS`, `KEYS`, `LABEL`, `VEGETARIAN_AVOID`, `tagsOf`, `parseList`, `matchesFor`

## `src/hall/extraSchema.js`
Exports: `ensureHallExtraSchema`

## `src/hall/feastRsvp.js`
Helpers for feast RSVPs. No database code in here, so they are easy to test.

Exports: `RSVP_STATUSES`, `parseRsvpStatus`, `hasSeat`

## `src/hall/financeSchema.js`
Mess finance: what the hall spends (food, gas, wages ...). Income comes from the bills that already exist.

Exports: `ensureHallFinanceSchema`

## `src/hall/index.js`
Hall = the meal system (students & teachers switch each meal on/off, weekly menu, feasts, monthly bill).

Exports: `router`, `ensureHallSchema`, `startJobs`

## `src/hall/jobs.js`
Cut-off job: once a meal is locked, write down every person's state for it (source = 'auto' where they never chose, copied from their previous choice). After this the day's numbers are fixed.

Exports: `runAutoFill`, `startAutoFill`

## `src/hall/lastcallSchema.js`
Last-call plates: leftover plates sold cheaply at the end of a meal (less food waste), claimed with the wallet.

Exports: `ensureHallLastCallSchema`

## `src/hall/ratingsSchema.js`
Meal ratings: one row per person, date and meal (rating again just updates the row).

Exports: `ensureHallRatingsSchema`

## `src/hall/schema.js`
Hall tables. The server runs this on every start (safe to repeat: CREATE TABLE IF NOT EXISTS).

Exports: `ensureHallSchema`

## `src/hall/states.js`
"Effective" on/off state of a person's meals.

Exports: `loadStates`, `DEFAULT_STATE`, `MAX_DAYS`

## `src/hall/util.js`
Small helpers shared by every Hall route.

Exports: `SLOTS`, `nowParts`, `isDateKey`, `addDays`, `cutoffOf`, `isLocked`, `localStamp`

## `src/loyalty.js`
Loyalty points + daily-order streak.

Exports: `DEFAULT_SETTINGS`, `getSettings`, `saveSettings`, `getAccount`, `awardForOrder`, `redeemForOrder`, `refundForOrder`, `summaryFor`

## `src/middleware/auth.js`
Exports: `verifyToken`, `requireRole`

## `src/offersSchema.js`
Schema + first-run seed for: loyalty points / streak, combo deals and happy hours.

Exports: `ensureOffersSchema`

## `src/pricing.js`
One place that decides what an order costs — used by placing an order (orders.js), the cart preview (/api/pricing/quote) and /api/coupon/validate, so the cart can never show a different price than the server charges.

Exports: `r2`, `loadHappyHours`, `loadCombos`, `isHappyHourActive`, `happyHourCovers`, `priceCart`, `priceOrder`, `quoteResponse`

## `src/referrals.js`
Referral codes: each student/teacher has a code; a friend who signs up with it and gets their first order collected earns both of them a wallet bonus.

Exports: `ensureCode`, `rewardReferral`, `REFERRAL_BONUS`, `MAX_REWARDS_PER_REFERRER`

## `src/restaurants.js`
Which restaurant a menu item belongs to — without touching the database schema.

Exports: `loadItemRestaurants`, `saveItemRestaurant`

## `src/stockAlerts.js`
"Notify me" — tells students who asked about an item that it is available again.

Exports: `pingWatchers`

## `src/utils/audit.js`
Exports: `recordAuditEvent`

## `src/utils/catchAsync.js`
Express 4 does NOT automatically catch a rejected promise thrown inside an async route handler — it turns into an unhandled rejection and takes down the *entire* Node process (every logged-in user, every request).

Exports: `catchAsync`

## `src/utils/clock.js`
Canteen-local clock helpers. Happy hours and the daily streak must follow the canteen's wall clock, not whatever timezone the server happens to run in. Set CANTEEN_TZ in .env (default Asia/Dhaka).

Exports: `TZ`, `localParts`, `toMinutes`, `dayDiff`, `addDays`

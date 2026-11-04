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

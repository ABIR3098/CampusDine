# Offers, loyalty and cart quote API

How the price is worked out is in [PRICING.md](PRICING.md). This page lists the endpoints.

## Customers (student, teacher)
| Method and path | What it does |
|---|---|
| `POST /api/pricing/quote` | Price a cart before ordering: combos, then happy hour, then coupon, then loyalty reward. Body: `items` (a list of `{ id, qty }`), and optionally `couponCode`, `rewardId` and `pickupTime` (`HH:MM`, so a happy hour is judged at pickup time) |
| `GET /api/loyalty/me` | My points, streak, available rewards and the points history |
| `GET /api/offers` | What is running: combos, happy hours (with "running now") and rewards. Any logged-in user |

## Admin
| Method and path | What it does |
|---|---|
| `GET /api/offers/admin` | Everything: combos, happy hours, rewards and the loyalty settings |
| `POST /api/offers/admin/combos` and `PUT /api/offers/admin/combos/:id` | Add or change a combo |
| `POST /api/offers/admin/happy-hours` and `PUT /api/offers/admin/happy-hours/:id` | Add or change a happy hour |
| `POST /api/offers/admin/rewards` and `PUT /api/offers/admin/rewards/:id` | Add or change a loyalty reward |
| `DELETE /api/offers/admin/:kind/:id` | Delete one. `kind` is `combos`, `happy-hours` or `rewards` |
| `GET /api/loyalty/settings` and `PUT /api/loyalty/settings` | Read or change the earn rate and streak rules |

## Loyalty settings
`earnPer` (taka per point, default 10), `streakDays` (default 5) and `streakBonus` (default 50 points).
Each must be a whole number; the server refuses values outside its limits.

## Errors
400 empty `items`, an item without a valid id or quantity, or a setting that is not a whole number; 404 unknown item, offer type or offer.

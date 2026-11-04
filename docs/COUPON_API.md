# Coupon API

All routes need `Authorization: Bearer <token>`. Base path: `/api/coupon`.

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/available` | any | Active coupons that are not expired or used up |
| POST | `/validate` | any | Check a code against a cart and return the discount |
| POST | `/apply` | any | Apply a coupon to one of my `Received` orders (older route; the cart uses the quote route) |
| GET | `/` | admin | All coupons |
| POST | `/` | admin | Create a coupon |
| PUT | `/:couponId` | admin | Change a coupon |

## Rules for a coupon
- Code: 3-50 letters, numbers, `-` or `_`, stored in capitals.
- `discountType` is `PERCENTAGE` (1-100) or `FIXED`.
- Optional: `minOrderAmount`, `maxDiscount`, `usageLimit` (whole number), `expiryDate` (`2026-12-31` means the end of that day) and `description`.
- One use per person.

## `/apply` checks
It refuses a coupon that is inactive, expired, used up, already used by this person, below the minimum order, or when the order already has a discount. The discount is never more than the order total.

## Errors
`400` bad input or rule broken, `403` not an admin, `404` coupon or order not found, `409` code already exists.

The shared rules are in `backend/src/utils/couponRules.js` with tests in `backend/tests/couponRules.test.js`.

## Prize coupons
`backend/migrations/20261101_prize_coupons.sql` creates the coupons that the Daily Spin and the Scratch Card show as prizes. Run it once after the database exists:

```
mysql -u root -p campusdine < backend/migrations/20261101_prize_coupons.sql
```

| Code | Discount | Applies to |
|---|---|---|
| `TEHARI10` | 10% off, at most 30 taka | Tehari |
| `STUDY15` | 15% off, at most 40 taka | Singara, Fuchka, Chicken Roll |
| `FREECHAI` | 10 taka off (a free tea) | Cha (Tea) |
| `CASH5` | 5 taka off an order of 50 taka or more | everything |

The spin and the card only show the prize; the person types the code at checkout. `COOKIE` is not created because there is no cookie on the menu, and prizes that say "wallet bonus" are still not paid out by the server.

# How an order price is worked out

One module, `backend/src/pricing.js`, prices every order. Placing an order, the cart preview (`/api/pricing/quote`) and coupon validation all use it, so the cart never shows a different price from the one charged.

Discounts are applied in this order. Each step works on what is left from the step before.

1. **Combo deals.** A complete set of a combo's items costs the combo price. The biggest saving per set goes first, and one unit can belong to only one combo. A combo that costs more than its parts is ignored.
2. **Happy hour.** A percentage or fixed amount off the units not already used by a combo. When several happy hours cover a line, only the best one applies. A window may run past midnight and belongs to the day it started on.
3. **Coupon.** Checked against the amount after steps 1 and 2: active, not expired, usage limit, minimum order and once per user. A coupon for selected items counts only those lines. The discount is capped by `max_discount` and by the eligible amount.
4. **Loyalty reward.** Points buy either a fixed discount or one free unit of an item, at the price actually being paid for it. The total never goes below zero.

Points earned are `floor(total / earnPer)`, where `earnPer` is a loyalty setting (never below 1).

## Tests
`backend/tests/pricing.test.js` covers happy-hour timing. `backend/tests/priceCart.test.js` covers combos and happy-hour discounts using a fake database.

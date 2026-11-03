# Gamification API

Both routes need a login token (`Authorization: Bearer <token>`).

## POST /api/gamification/spin/claim

One free spin per day. The request body is ignored: the **server** picks the prize
(0, 2, 3, 5 or 10 taka), so a client cannot choose its own reward.

| Case | Answer |
| --- | --- |
| First spin today | `200` `{ message, reward: { rewardType, value } }` (`rewardType` is `cash` or `none`) |
| Already spun today | `429` `{ error }` |
| Unknown user | `404` |

Every spin, even a 0 prize, is stored as a `Daily spin reward` row in `wallet_transactions`.
That row is what limits the user to one spin per day. A prize above 0 is also added to the wallet balance.

## GET /api/gamification/leaderboard

The ten students and teachers with the most orders this month (cancelled orders are not counted).
Each row is `{ rank, name, orders, badge, isCurrent }`.
If you are not in the top ten, your own row is added at the end with your real rank (only when you have at least one order this month).

Badges: 20 or more orders = `Top Diner`, 10 or more = `Regular`, otherwise `Rising Diner`.

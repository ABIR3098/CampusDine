# Who can call what

Roles: `student`, `teacher`, `admin`, `rider` and `hall_admin`. A route that lists no role accepts any logged-in user.

| Area | student | teacher | admin | rider |
|---|---|---|---|---|
| Menu: read, favourites | yes | yes | yes | yes |
| Menu: add and change items | no | no | yes | no |
| Menu: "notify me" alerts | yes | yes | no | no |
| Place and cancel orders, rate, report a problem | yes | yes | no | no |
| Advance orders, scan pickup codes, answer reports | no | no | yes | no |
| Wallet: balance and history | yes | yes | yes | yes |
| Wallet: top-up, send money, referral | yes | yes | no | no |
| Group orders, calendar, recurring, feedback, summary | yes | yes | no | no |
| Cart quote and loyalty (`/api/pricing`, `/api/loyalty/me`) | yes | yes | no | no |
| Offers: read | yes | yes | yes | yes |
| Offers and loyalty settings: change | no | no | yes | no |
| Support chat (canteen inbox) | yes | yes | yes | no |
| Support chat (hall inbox, `scope=hall`) | yes | yes | yes, as a member: talks to the Hall Admin only inside the Hall | no |
| Order chat | yes | yes | no | yes |
| Reports, announcements, analytics, audit | no | no | yes | no |
| Rider shifts and route | no | no | no | yes |
| Assign a rider to an order | no | yes | yes | no |

Hall routes are in [HALL_API.md](HALL_API.md) and Hall Admin routes in [HALL_ADMIN_API.md](HALL_ADMIN_API.md).
The role is stored in the login token, so a changed role takes effect when the person logs in again.

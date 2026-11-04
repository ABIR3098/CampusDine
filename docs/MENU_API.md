# Menu API

Base path: `/api/menu`. Every call needs a login token (`Authorization: Bearer <token>`).

| Method and path | Who | What it does |
|---|---|---|
| `GET /` | any logged-in user | The menu, with `is_favorite`, calories and allergens for each item |
| `POST /:id/favorite` | any logged-in user | Star an item (safe to repeat) |
| `DELETE /:id/favorite` | any logged-in user | Remove the star |
| `POST /` | admin | Add an item |
| `PUT /:id` | admin | Change price, stock, tag, veg flag or availability |
| `GET /alerts` | student, teacher | Items I asked to be told about |
| `POST /:id/notify` | student, teacher | Tell me when a sold-out item is back |
| `DELETE /:id/notify` | student, teacher | Stop the alert |

## Add an item (admin)
Body: `name`, `category`, `price` are required. Optional: `nameBn`, `stock`, `tag`, `isVeg`, `restaurant`
(`amitie`, `vista`, `thirdplace` or `staff`; the default restaurant is used when it is left out).

## Change an item (admin)
Body may hold `price`, `stock`, `tag`, `isVeg` and `availability`. `availability` must be
`available`, `sold_out` or `hidden`. A request with nothing to change gets 400.
After a change the server sends the `menu:changed` socket event so open menus refresh.

## Errors
- 400: missing fields, unknown restaurant, bad availability value, nothing to update
- 404: item not found (also for `hidden` items on `notify`)
- 409: `notify` on an item that is available right now

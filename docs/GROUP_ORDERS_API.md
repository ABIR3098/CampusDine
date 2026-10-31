# Group orders API: `/api/group-orders`

Friends can share one list of items. One person (the host) starts a group and shares its join code;
the others join and add what they want.

Every route needs a login token and the role `student` or `teacher`.

**What it does not do:** a group only collects the items. There is no route here that places or pays the
order, and nothing sets the status `CHECKED_OUT` (it exists in the table but is not used yet).

## Routes

| Method and path | What it does |
|---|---|
| `POST /` | Start a group. Body `{ title? }`. The title is trimmed and cut at 100 characters; without one it is "Campus group order". The host is added as the first member. The group closes 30 minutes after it is made. Answers `201` with `{ id, title, joinCode, closesAt, hostUserId, status: "OPEN" }`. |
| `POST /join` | Join with a code. Body `{ joinCode }` (capital letters or small ones both work). Joining twice is harmless. Answers `{ ok, groupId, title, joinCode }`. |
| `GET /` | My groups that are still open and not past their closing time. Each has `id, title, joinCode, closesAt, status, hostUserId, hostName, members`. |
| `GET /:id` | One group with its `members` and `items`. Only members can see it. Works for closed groups too. |
| `POST /:id/items` | Add items. Body `{ menuItemId, qty }`. `qty` is a whole number from 1 to 20. Adding the same item again adds to the quantity. Answers `201 { ok: true }`. |
| `POST /:id/close` | Close the group. Only the host can, and only while it is open. |

The join code is 8 letters and digits (for example `A3F09C12`).

## Answers

| Status | When |
|---|---|
| `400` | Empty title or code, or an invalid group, item or quantity. |
| `403` | Not a member of the group (`GET /:id`, `POST /:id/items`). |
| `404` | No group with that code or id. |
| `409` | The group is closed or past its closing time; the item is not available or not in stock; the group's total for one item would pass 20 or the stock; or `close` by someone who is not the host, or on a group that is already closed. |

## Good to know

- A group that passes its closing time is treated as closed even though its stored status still says `OPEN`.
- The 20-item limit is for the whole group per menu item, not per person.
- Stock is checked when an item is added, but nothing is taken from stock, so the item can still run out before the real order is placed.

# Hall weekly menu

The hall menu is a fixed weekly table: **7 days x 3 meals** (breakfast, lunch, dinner). It is the same every week.

## Where the data lives
- Table `hall_menu` with columns `dow`, `slot`, `items` (created in `backend/src/hall/schema.js`).
- `dow` is the weekday number: `0` = Sunday ... `6` = Saturday. The screen shows Saturday first.
- `slot` is `breakfast`, `lunch` or `dinner`; `items` is one line of text, up to 255 characters.

## Sample data
`schema.js` inserts a sample menu with `INSERT IGNORE`, so it never overwrites what an admin has already edited.
To change the *starting* menu for a fresh database, edit the `INSERT IGNORE INTO hall_menu` block in that file.

## Editing the menu
Hall admins edit it in the app: open the **Menu** tab, click a meal, change the text and click outside the box to save.
The **Copy to all days** button writes one meal to the same slot on every other day.

## Weekday numbers
| `dow` | Day |
| --- | --- |
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

# Adding menu items with `more_menu_items.sql`

`backend/more_menu_items.sql` adds extra food items to the four restaurants without touching existing data.

## How to run
```
mysql --default-character-set=utf8mb4 -u root -p campusdine < backend/more_menu_items.sql
```
Run it **after** `schema.sql`. It is safe to run more than once: an item is inserted only if no item with the same name exists.

## How it is organised
1. The first block inserts the items: name, Bangla name, category (`heavy`, `snacks` or `drinks`), price in Taka, stock, tag, vegetarian flag and image.
2. The second block records which restaurant each item belongs to (`amitie`, `vista`, `thirdplace` or `staff`) in `app_meta`.
3. The last query prints how many items each restaurant has.

## Adding one more item
Add one `UNION ALL SELECT ...` line to the items block and one to the restaurant block, using the same name in both.
Images live in `frontend/images/food/`; use `default.svg` if there is no matching picture.

## Current size
The file adds **132** items: Amitie 33, Vista 33, Third Place 33 and Staff Canteen 33.

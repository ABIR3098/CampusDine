# Contributing

## Commit messages
Use a short prefix, then a plain description:

- `feat:` a new feature or content (for example a new menu item)
- `fix:` a bug fix
- `docs:` documentation only
- `style:` CSS or formatting only
- `test:` tests only
- `chore:` tooling and config

Keep each commit to one small change.

## Before you push
1. Run `npm test` in `backend/`.
2. Make sure `backend/.env` is not staged (`git status`).
3. Add a line to `CHANGELOG.md` for user-visible changes.

## Adding a menu item
Add it to `backend/more_menu_items.sql` (both blocks) and, if you know them, its calories and allergens to `NUTRITION_BY_NAME` in `backend/src/catalog.js`. One item per commit.

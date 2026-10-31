# Hall frontend modules

The Hall screens live in `frontend/hall/`, one `.jsx` file per feature. This list shows what each file is for, taken from the comment at the top of the file.

## `account.jsx`
Hall profile tab. Payment and wallet features are intentionally excluded from Hall.

## `adminChips.jsx`
Admin Home: what needs attention right now, one tap away.

## `adminDayNav.jsx`
Admin Home: look at another day with ‹ and › instead of only today.

## `advanced.jsx`
Advanced Hall workflows. Uses the shared Hall shell and authenticated call() helper.

## `autofill.jsx`
Step 5 — admin tab: the cut-off job. It runs by itself every minute; "Run now" is for checking.

## `autopay.jsx`
Auto-pay, member side: one switch on My bill.

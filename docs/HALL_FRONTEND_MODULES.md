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

## `autopayAdmin.jsx`
Auto-pay, admin side: run it right now for one month (it also runs by itself between the 1st and the 10th).

## `balanceAlert.jsx`
Home: warns when the wallet can't cover the Hall bill.

## `bill.jsx`
Step 10 — "My bill" tab: what each meal costs, day by day, and the month's total.

## `billExport.jsx`
"Download CSV" and "Print / PDF" buttons for the My bill tab.

## `core.jsx`
Hall core: shared helpers + small UI pieces (card, ON/OFF switch, hero slider), the page shell

## `cutoffReminder.jsx`
Home: reminder for meals that are about to close ("Dinner closes in 40m — it is ON").

## `defaulters.jsx`
Dues (admin): who still owes money for a month, how much, whether their wallet can cover it,

## `diet.jsx`
Diet, member side: say what you don't eat and what you are allergic to. The week's menu then shows

## `dietAdmin.jsx`
Diet, admin side: for one day, which meals contain what, and how many people who have that meal ON

## `dietAlert.jsx`
Home: a warning when a meal that is ON for you in the next 3 days contains something you avoid or are allergic to.

## `feasts.jsx`
Step 7 — "Feasts" tab: special meals on a given date. Everyone sees the list; admin can add / remove.

## `finance.jsx`
Finance (admin): how the mess is doing this month — what was billed and collected, what was spent,

## `financeCharts.jsx`
Small charts drawn with plain divs (no library), so they also print cleanly.

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

## `financeCompare.jsx`
Finance: how this month compares with the one before ("↑ 12% vs last month").

## `financeExpenses.jsx`
Mess finance: add an expense, and the list of this month's expenses.

## `homeExtras.jsx`
The alerts that sit at the top of the member Home tab: closing-soon reminder and low-wallet warning.

## `lastcall.jsx`
Last call, member side: at the end of a meal the canteen puts leftover plates up at a low price.

## `lastcallAdmin.jsx`
Last call, admin side: put up leftover plates, see who took them, hand them over by code, refund a plate nobody collected.

## `lastcallRepeat.jsx`
Last call (admin): fill the form from the last time, in one tap.

## `meals.jsx`
"My meals" tab: the next 7 days, three meals a day. Switch a meal ON / OFF until its cut-off.

## `menu.jsx`
Step 6 — "Menu" tab: the fixed weekly menu, 7 days x 3 meals. Admin can edit any cell.

## `menuCopy.jsx`
Menu (admin): copy one meal to the same meal on every other day with one click.

## `ratings.jsx`
Ratings, student side: rate the meals you had (1-5 stars + an optional comment).

## `ratingsAdmin.jsx`
Ratings, admin side: what students think of the meals (average, spread, best / lowest meals, latest comments).

## `ratingsTrend.jsx`
Ratings (admin): is each meal getting better or worse? A small line per meal time.

## `report.jsx`
Step 12 — admin "Reports" tab: plates per day and meal, who is off, who changed what and when.

## `reportCsv.jsx`
Reports: download what is on the screen as a spreadsheet (CSV).

## `reportPrint.jsx`
Reports: print the page, or choose "Save as PDF" in the print window. The top bar, tabs and buttons are hidden while printing.

## `savings.jsx`
Home: "your month so far" — how many closed meals were ON / OFF and how much the OFF meals saved.

## `serveExtras.jsx`
Serve tab (admin): progress of the meal, a soft beep for each new token, and a sound switch.

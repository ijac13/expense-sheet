# Income and business earnings (Rent and Uber)

## Decisions from your review

- Cut-off sentence: nothing to add.
- **Home income categories** use the same order: Salary, Uber, Rent received, Random.
- **Random** (雜項收入) replaces Speaking: plain income for rare one-offs like a talk.
- **Money in** = Salary + Uber earnings + Rent earnings + Random, shown at the top of the Earnings page.
- **Earnings page order:** Salary, Uber, Rent, Random, one card each.
- Business-costs control is a two-option choice: **Life only** | **Include business costs**.
- Expense / Income toggle sits just above the category icons.
- **No Rent tab in the sheet.** Rent and Uber are tags on Expenses rows; income goes in one new Income tab.
- **Mixed costs (option B):** each expense is tagged **For: ❤️ Life / Rent / Uber** when you log it. A tank of fuel for driving gets Uber, a tank for daily use stays Life.

## Goal

- Record expenses **and** income from the home screen.
- Treat Rent and Uber as small businesses, so each one shows its own earnings each month: its income − the expenses tagged to it.
- Spending reports show Life spending only (Fixed, Big extras, Living costs). Business-tagged expenses are left out by default; "Include business costs" adds them back for the full total.

## What you'll get

- **Home screen**
  - **Expense / Income toggle** just above the category icons. Income mode shows income categories and "Received by" in place of "Paid by".
  - **"For" tag** above the date in expense mode: ❤️ Life · 🏠 Rent · 🚗 Uber. It starts at Life. Rent paid and Tenant fill in Rent for you, and you can change it on any expense.
- **New categories**
  - Expense: **Rent paid** (房租支出), which fills in Rent
  - Existing **Tenant** (房客支出) fills in Rent. Your past Tenant rows count as Rent automatically, with no data to migrate.
  - Income: **Salary** (薪水), **Uber** (Uber business), **Rent received** (房租收入, Rent business), **Random** (雜項收入)
  - Fuel, Car repair, Tolls and the rest stay as they are. Tag them Uber when they're for driving.
- **Reports**
  - The total and the cost groups count only Life expenses (Fixed + Big extras + Living costs).
  - **Life only** | **Include business costs** on the Total spending card. The second option adds two groups, Rent (房租) and Uber, and shows the full total.
  - A new row, **"Income & earnings ›"**, opens the second-level page.
  - AI insights look at Life spending only.
- **Income & earnings page** (second level, opened from Reports), for the same month or year you're viewing:
  - Money in vs spending, and what's left over
  - One card each, in order: **Salary**, **Uber**, **Rent**, **Random**
  - **Uber card:** Uber income − Uber-tagged expenses (fuel, car wash…) = **Uber earnings**
  - **Rent card:** Rent received − Rent-tagged expenses (rent paid, tenant costs) = **Rent earnings**, plus the last 6 months as small bars. Green means it made money, red means it lost money.
- **History** shows income rows with a green "+", and each expense row shows its tag (Rent / Uber). You can edit the tag later from the edit sheet.
- **Subscriptions** accept income categories: a Salary subscription is logged to the Income tab each month (added during the build, at your request).
- **Settings › Categories:** each category gets a "Fills in" picker (Life / Rent / Uber). That's how Rent paid and Tenant default to Rent.

## Mockup

- [Income & earnings mockup](https://claude.ai/artifact/TVBK4UkM7eYo93UhjfE99z): clickable, example numbers. Use the bottom navigation. Home has the toggle and the For tag. Income & earnings opens from Reports.

## Not in this round

- Re-tagging past fuel as Uber. Old expenses stay Life unless you edit them one by one.

## How it's built (for reference)

- **Google Sheet**
  - New **Income** tab: id, date, amount, category_id, received_by, created_by, notes, created_at
  - **Expenses** tab gets a `business` column (blank / rent / uber). Blank means "use the category's default".
  - **Categories** tab gets `kind` (expense / income) and `business` (the default it fills in). The app creates the columns itself, the same way it added `fixed`.
  - New category rows added by a one-time script: staging first, then production.
- **Functions** (`functions/src/index.ts`): add, list, edit and delete routes for income; expenses accept and return `business`.
- **App**
  - `app/app/page.tsx`: Expense / Income toggle and the For tag
  - `app/app/lib/reportService.ts`: an expense's business = its own tag, else its category's default. Business expenses leave the cost groups unless "Include business costs" is on; new earnings summary per business.
  - New page `app/app/reports/earnings/`
  - History: merged list, tag shown, tag editable in the edit sheet
  - Settings: "Fills in" picker
  - i18n: English and 中文
- **Tests** for the earnings math (including a month with a loss), the tag-then-category-default rule, and business costs leaving the spending total.
- **Ship:** branch → PR → staging preview → merge → production deploy.

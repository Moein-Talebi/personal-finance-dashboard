# Pages Reference Part 1

> **Purpose**: Complete reference for dashboard, transactions, budget, accounts, goals, and deadlines pages.
> Last updated: 2026-08-18

---

## 1. dashboard.js (411 lines)

**Path**: `public/js/pages/dashboard.js`
**Object**: `DashboardPage`
**State**: None (fetches fresh on each render)

### Methods
- `async render(container)`: Fetches `GET /api/dashboard`, renders stat cards, charts, cross-section panels

### API Calls
- `GET /api/dashboard` -> receives: net_worth, total_debt, month_income, month_expense, month_savings, total_budget, total_spent_budget, budget_usage_pct, recent_transactions[], upcoming_bills[], upcoming_deadlines[], goals[], category_spending[], monthly_history[]

### DOM Structure
1. **Stats Grid** (`.grid-cols-4`): 4 stat cards
   - Net Worth (wallet icon, success, 12.1% up trend)
   - Monthly Income (arrow-down-left icon, success, 6.3% up trend)
   - Monthly Expenses (arrow-up-right icon, danger, 2.4% down trend)
   - Total Debt (credit-card icon, warning, link to #debts)
2. **Charts Row** (`.grid-cols-2`):
   - Money Flow: Grouped bar chart (income #6E54FF, expense #FF970C) on `#dash-history-chart`
   - Budget Distribution: Doughnut chart (cutout 75%) on `#dash-category-chart` with legend in `#donut-legend-container`
3. **Cross-Section Row** (`.grid-cols-2`):
   - Upcoming Bills & Subscriptions: from `data.upcoming_bills`, shows name, due date, category, overdue/due-today/upcoming badges, amount. Link to `#recurring`
   - Financial Deadlines: from `data.upcoming_deadlines`, shows title, due date, amount, priority pill. Link to `#deadlines`
4. **Lower Row** (`.grid-cols-2`):
   - Recent Transactions: table with category icon, date, account, amount. Link to `#transactions`
   - Saving Goals: progress bars with % achieved. Link to `#goals`

### Cross-Page Links
`#debts`, `#budget`, `#recurring`, `#deadlines`, `#transactions`, `#goals`

### Business Logic
- Bill overdue check: `next_due < today`
- Goal %: `Math.min(100, Math.round((current / target) * 100))`
- Category top 5: sorted by total descending, sliced to 5
- Deadline priority mapping: high->danger, medium->warning, else->info

### Chart.js Configs
- Doughnut: cutout 75%, border matches --bg-card
- Bar: borderRadius 8, barThickness 16, Outfit font

---

## 2. transactions.js (404 lines)

**Path**: `public/js/pages/transactions.js`
**Object**: `TransactionsPage`
**State**: `transactions: []`, `accounts: []`, `categories: []`, `filters: { search, accountId, categoryId, type }`

### Methods
- `async render(container)`: Fetches transactions, accounts, categories in parallel. Calls renderWorkspace.
- `renderWorkspace(container)`: Builds filter toolbar + table layout. Calls renderFilterTags, filterData, attachEvents.
- `hasActiveFilters()`: Returns true if any filter has value.
- `renderFilterTags()`: Generates active filter chips in `#active-filters-chips` with clear buttons.
- `filterData()`: Filters `this.transactions` by all active filters, updates `#tx-table-body`.
- `renderRows(txList)`: Returns `<tr>` HTML for each transaction.
- `attachEvents(container)`: Binds all filter inputs, add button, delete buttons.
- `openAddModal()`: Opens add transaction modal.

### API Calls
- `GET /api/transactions` (parallel with accounts + categories)
- `GET /api/accounts`
- `GET /api/categories`
- `DELETE /api/transactions/${id}` (with confirm)
- `POST /api/transactions` body: `{ type, amount, account_id, category_id, target_account_id, date, note }`
- CSV export: direct link to `GET /api/transactions/export`

### Add Transaction Modal
- Title: 'Adding a transaction'
- Tabs: Expense (default), Income, Transfer (`.modal-tabs` with `.modal-tab-btn`)
- Hidden input `#modal-tx-type` tracks selected tab
- Fields: amount, account select, category select (hidden for transfer), target account (shown for transfer), date (today default), note
- Transfer uses `categories[0].id` as fallback category
- Validation: amount > 0

### DOM Structure
- Filter toolbar card: `#tx-search`, `#tx-account-filter`, `#tx-category-filter`, `#tx-type-filter`, `#export-csv-btn`, `#add-tx-btn`
- Active filters: `#active-filters-chips` (chip-grid)
- Ledger table: columns Date, Category, Note/Memo, Account, Status, Amount, Actions

### Status Simulation
- `id % 12 === 0` -> pending
- `id % 20 === 0` -> refund
- `id % 25 === 0` -> cancelled
- else -> successful

---

## 3. budget.js (302 lines)

**Path**: `public/js/pages/budget.js`
**Object**: `BudgetPage`
**State**: `categories: []`

### Methods
- `async render(container)`: Fetches categories + transactions. Filters expense categories and current month transactions. Computes totals. Renders gauge + category grid.
- `renderGaugeChart(pct)`: Half-doughnut gauge on `#budget-overall-gauge` (rotation -90, circumference 180, cutout 80%).
- `attachEvents(container)`: Binds add category button + edit buttons.
- `openCategoryModal(category = null)`: Create/edit category modal.

### API Calls
- `GET /api/categories`
- `GET /api/transactions`
- `PUT /api/categories/${id}` body: `{ name, type, expense_type, budget_limit, icon, color, rollover }`
- `POST /api/categories` body: same

### Category Modal
- Title: 'Modify Category: {name}' or 'Create Budget Category'
- Fields: name, type (expense/income), classification (fixed/variable/discretionary), monthly limit, icon ID, color picker, rollover checkbox
- Validation: name required

### DOM Structure
- Header with `#add-category-btn`
- Overview row (`.grid-cols-2`): gauge chart card + status summary card
- Categories grid (`.budget-grid`): cards with icon, name, classification pill, edit btn, spent/limit, progress bar, status

### Computed Values
- `totalAllocated`: sum of budget_limits
- `totalSpent`: sum of current month expense transactions
- `totalPct`: Math.round((spent/allocated)*100)
- Status: >90% -> Critical (danger), >75% -> approaching (warning), else on track (success)
- Classification colors: fixed->info, discretionary->warning, variable->success

---

## 4. accounts.js (318 lines)

**Path**: `public/js/pages/accounts.js`
**Object**: `AccountsPage`
**State**: `accounts: []`

### Methods
- `async render(container)`: Fetches accounts. Renders credit-card style grid + trend chart.
- `renderTrendChart()`: Purple gradient line chart on `#wallet-trend-chart` with mock data.
- `attachEvents(container)`: Binds add, transfer, edit, delete buttons.
- `openAccountModal(acct = null)`: Create/edit account modal.
- `openTransferModal()`: Internal fund transfer modal.

### API Calls
- `GET /api/accounts`
- `DELETE /api/accounts/${id}` (with confirm)
- `PUT /api/accounts/${id}` body: `{ name, type, balance, color }`
- `POST /api/accounts` body: same
- `GET /api/categories` (for transfer - gets default category)
- `POST /api/transactions` body: `{ type: 'transfer', account_id, target_account_id, category_id, amount, date, note }`

### Account Modal
- Title: 'Edit Wallet: {name}' or 'Create New Account Card'
- Fields: name, type (checking/savings/credit/cash/investment), balance, color
- Validation: name required

### Transfer Modal
- Title: 'Move Funds internally'
- Fields: source account, destination account, amount, date
- Validation: source != destination, amount > 0
- Note auto-generated: 'Internal transfer to {destination name}'

### DOM Structure
- Header with total balance, `#transfer-btn`, `#add-account-btn`
- Account cards grid: `.finance-card` with rotating gradient (1/2/3), masked card number, type label, balance
- Trend chart card: purple area line chart

### Card Type Mapping
- savings -> 'SAVINGS', credit -> 'MASTERCARD', cash -> 'CASH', investment -> 'INVEST', else -> 'VISA'

---

## 5. goals.js (319 lines)

**Path**: `public/js/pages/goals.js`
**Object**: `GoalsPage`
**State**: `goals: []`

### Methods
- `async render(container)`: Fetches goals. Renders summary chips + goal cards grid + growth chart.
- `renderGrowthChart()`: Purple wave line chart on `#goals-growth-chart` with mock data.
- `attachEvents(container)`: Binds add, contribute, edit, delete buttons.
- `openGoalModal(goal = null)`: Create/edit goal modal.
- `openContributionModal(goal)`: Add funds to goal modal.

### API Calls
- `GET /api/goals`
- `DELETE /api/goals/${id}` (with confirm)
- `PUT /api/goals/${id}` body: `{ name, target_amount, current_amount, deadline, color }` (full update)
- `POST /api/goals` body: same
- `PUT /api/goals/${id}` body: `{ contribution: amount }` (contribution mode)

### Goal Modal
- Title: 'Edit Goal: {name}' or 'Create Savings Goal'
- Fields: name, target amount (EUR), current amount (EUR), deadline (default today+180 days), color
- Validation: name required, target > 0

### Contribution Modal
- Title: 'Contribute to {name}'
- Fields: contribution amount (EUR, large centered input)
- Validation: amount > 0

### DOM Structure
- Header with `#add-goal-btn`
- Summary chips: Total Goals, In Progress, Not Started, Finished
- Goals grid (`.goals-grid`): cards with icon, title, deadline, edit/delete btns, current/target amounts, progress bar, status pill, remaining amount or Completed icon, contribute btn
- Growth chart card

### Computed Values
- Finished: current_amount >= target_amount
- In progress: current > 0 AND current < target
- Not started: current === 0
- Default deadline: today + 180 days
- Completed icon uses Lucide `check-circle-2` (NOT emoji)

---

## 6. deadlines.js (335 lines)

**Path**: `public/js/pages/deadlines.js`
**Object**: `DeadlinesPage`
**State**: `deadlines: []`, `recurringItems: []`, `debts: []`

### Methods
- `async render(container)`: Fetches deadlines, recurring, debts. Builds auto-detected list. Renders sections.
- `attachEvents(container)`: Binds add, pin, complete, delete buttons.
- `openDeadlineModal(prefill = {})`: Add/pin deadline modal.

### API Calls
- `GET /api/deadlines`
- `GET /api/recurring`
- `GET /api/debts`
- `PUT /api/deadlines/${id}/complete`
- `DELETE /api/deadlines/${id}` (with confirm)
- `POST /api/deadlines` body: `{ title, description, due_date, amount, category, priority }`

### Auto-Detection Logic
1. **Recurring items**: Active expenses -> builds cards with name, frequency description, next_due, amount
2. **Debts**: current_balance > 0 -> calculates due date from `due_day`:
   - Creates date in current month
   - If already passed today, rolls to next month
   - Amount: minimum_payment (if > 0) or current_balance
3. Merged and sorted ascending by due_date

### Deadline Modal
- Title: 'Pin Deadline: {title}' or 'Add Financial Deadline'
- Fields: title, description, due date (today default), amount (EUR), category (bill/debt/goal/tax/custom), priority (high/medium/low, default medium)
- Validation: title and due_date required
- Pin button prefills all fields from auto-detected item

### DOM Structure
- Header with `#add-deadline-btn`
- Auto-Detected section: sparkles icon, detected items with repeat/credit-card icons, pin buttons (`.pin-deadline-btn`)
- Pinned & Custom section: deadline cards with calendar-clock icon, status badge (Upcoming/Completed/Overdue), priority badge, done button (`.complete-dl-btn`), delete button (`.delete-dl-btn`)

### Cross-Page Links
`#recurring` (from auto-detected recurring items), `#debts` (from auto-detected debt items)

### Status Logic
- completed (status === 'completed'): success badge, card opacity 0.6
- overdue (due_date < today AND not completed): danger badge, red icon bg
- upcoming: info badge
- Priority colors: high->danger, medium->warning, low->muted

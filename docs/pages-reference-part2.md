# Pages Reference Part 2

> **Purpose**: Complete reference for needs, debts, analytics, recurring, and notifications pages.
> Last updated: 2026-08-18

---

## 1. needs.js (141 lines)

**Path**: `public/js/pages/needs.js`
**Object**: `NeedsCalculatorPage`
**State**: None

### Methods
- `async render(container)`: Fetches needs data, renders stat cards + 50/30/20 comparison + category breakdown table.

### API Calls
- `GET /api/needs-calculator` -> receives: expected_income, survival_cost, total_needed, net_gap, ratios (needs_pct, wants_pct, savings_pct), categories[]

### DOM Structure
1. Header: "Monthly Needs & Survival Calculator"
2. Stats grid (`.grid-cols-4`): Expected Income (success), Survival Cost (danger), Total Need (warning), Net Gap (primary, dynamic color based on positive/negative)
3. 50/30/20 card: Three progress bars with actual vs target comparison
   - Needs: target 50%, bar color danger if >60%, else primary
   - Wants: target 30%, bar color warning if >40%, else info
   - Savings: target 20%, bar color always success
4. Category breakdown table: Category name, Classification badge (fixed=info, variable=success, other=warning), Icon, Budget limit

### No modals, no events, no cross-links.

---

## 2. debts.js (412 lines)

**Path**: `public/js/pages/debts.js`
**Object**: `DebtTrackerPage`
**State**: `debts: []`, `accounts: []`, `expandedHistories: {}`

### Methods
- `async render(container)`: Fetches debts + accounts. Renders stat cards + debt card grid.
- `attachEvents(container)`: Binds add, pay, toggle history, edit, delete buttons.
- `openDebtModal(debt = null)`: Create/edit debt with Quick Setup presets.
- `openPaymentModal(debt)`: Record installment payment.

### API Calls
- `GET /api/debts` (includes nested payments[])
- `GET /api/accounts`
- `DELETE /api/debts/${id}` (with confirm)
- `PUT /api/debts/${id}` body: `{ name, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color }`
- `POST /api/debts` body: same
- `POST /api/debts/${id}/payment` body: `{ amount, account_id, date, note }` (auto-advances `next_payment_date` by 1 month for loans)

### Debt Modal
- Title: 'Edit Debt: {name}' or 'Add Debt / Borrowed Money Record'
- Quick Setup Presets (only when adding new):
  - `#preset-borrowed-friend`: "Borrowed from Friend (0% Interest)" -> rate=0, color=#3B82F6, clears next_payment_date
  - `#preset-bank-loan`: "Bank Loan / Credit Card" -> rate=7.5, color=#EF4444, next_payment_date=today + 1 month
- Fields: name, total borrowed, remaining balance, interest rate APR%, monthly installment target, due day (1-31), next payment date (YYYY-MM-DD, scoped to bank/installment loans), color
- Total input auto-syncs to balance input unless manually edited (`dataset.manual`)
- Validation: name required, total > 0

### Payment Modal
- Title: 'Record Installment Payment: {name}'
- Save text: 'Confirm Payment'
- Shows debt summary (name, total borrowed, remaining balance)
- Fields: payment amount (default: min(minimum_payment, current_balance)), date, paying account (select with cash/direct option), budget expense category (prefilled with debt/loan category), memo
- Validation: amount > 0
- Overpayment check: if amount > current_balance + 0.01, confirms with user
- After payment: sets `expandedHistories[id] = true` to auto-expand log, calls `window.updateNotificationBadges()` to update real-time alerts

### DOM Structure
- Header with `#add-debt-btn`
- **Hero Overview Summary Banner**:
  - Left: Total Remaining Debt (large hero number with original amount), Overall Repayment Progress bar (% repaid and € paid down), Active accounts count, Monthly minimum obligation.
  - Right: Short-term Cash Needed (Next 10 Days) highlight box with due countdown, urgent badge, and earliest due date.
- **Dedicated 10-Day Urgent Action Strip**:
  - Horizontal quick-action pills for debts arriving within 10 days, showing days overdue/remaining, due date, amount, and direct 1-click "Pay" button.
- **Quick Filter Tabs**:
  - All Debts, Due in 10 Days, Personal Loans (0% APR), Bank Loans (APR > 0), Paid Off.
- **Debt cards grid (`.grid-cols-2`)**:
  - Filtered dynamically based on the selected tab and sorted by date of arriving.
  - Empty state with customized messages per filter tab.
  - Each card: icon (landmark if APR>0, else hand-coins), name, APR badge, Paid Off badge (if balance<=0), edit/delete btns, remaining vs original, progress bar (success color), paid off %, installment target, next payment date status badge, toggle history btn, pay installment btn (disabled if paid off)
  - Expandable history log: payment entries with date, source account, memo, negative green amount

### Computed Values
- totalOriginalDebt: sum of total_amount
- totalDebt: sum of current_balance
- totalPaidDown: totalOriginalDebt - totalDebt
- overallPct: round((totalPaidDown / totalOriginalDebt) * 100)
- totalMinPayments: sum of minimum_payment
- neededNext10Days: sum of required payments due within the next 10 days (including overdue)
- currentFilter: active tab filter ('all', 'due10', 'personal', 'bank', 'paid')
- isFullyPaid: current_balance <= 0
- defaultPaymentAmount: min(minimum_payment, current_balance) or current_balance if no min

---

## 3. analytics.js (259 lines)

**Path**: `public/js/pages/analytics.js`
**Object**: `AnalyticsPage`
**State**: None

### Methods
- `async render(container)`: Fetches analytics data, renders 4 charts + category table.

### API Calls
- `GET /api/analytics` -> receives: monthly_history[], category_spending[], top_categories[]

### DOM Structure
1. Header: "Financial Analytics" with EUR chip (`.chip-tag.active`)
2. Alert banner: "extra EUR1,700 saved" message (primary-light bg, primary border)
3. Top charts (`.grid-cols-2`):
   - Total Balance Overview: area line chart on `#analytics-balance-chart` (mock data: 11000-16400, gradient fill rgba(110,84,255,0.35)->0)
   - Budget vs Expense: grouped bar chart on `#analytics-compare-chart` (Income #6E54FF, Expense #FF970C)
4. Bottom grid (`.grid-cols-2`):
   - Spending by Category: doughnut chart on `#analytics-donut-chart` (cutout 70%, top 5 categories) with dynamic legend in `#analytics-legend-container`
   - Top Category Ledger: table with icon, name, total spent (red color)

### Chart.js Details
- Line chart: tension 0.4, gradient fill, Outfit font
- Bar chart: borderRadius 8, barThickness 16
- Doughnut: cutout 70%
- All charts use `getThemeColor(variable)` for dark/light mode compatible labels

### No modals, no events, no cross-links.

---

## 4. recurring.js (622 lines)

**Path**: `public/js/pages/recurring.js`
**Object**: `RecurringPage`
**State**: `recurringItems: []`, `accounts: []`, `categories: []`, `filters: { search, status: 'all', sortBy: 'due_asc' }`

### Methods
- `async render(container)`: Fetches recurring + accounts + categories. Calls renderTable.
- `getSortedAndFilteredItems()`: Applies search (name/category/account match), status filter (all/active/paused), and sort (due_asc/due_desc/amount_desc/amount_asc/name_asc).
- `getArrivalBadge(dueDateStr, active)`: Returns HTML badge:
  - Not active: 'Paused' (muted)
  - Past due: '{N}d overdue' (danger)
  - Today: Lucide zap icon + 'Due Today' (warning)
  - Tomorrow: 'Tomorrow' (warning)
  - Future: 'In {N} days' (info)
- `renderTable(container)`: Builds full page HTML with filters + data table.
- `attachEvents(container)`: Binds all controls.
- `calculateNextDueDate(currentDueDateStr, frequency)`: Date arithmetic:
  - monthly: +1 month
  - weekly: +7 days
  - bi-weekly: +14 days
  - yearly: +1 year
  - daily: +1 day
- `openLogPaymentModal(rec)`: Log payment + advance due date.
- `openRecurringModal(options = {})`: Add recurring rule with presets.

### API Calls
- `GET /api/recurring`, `GET /api/accounts`, `GET /api/categories`
- `PUT /api/recurring/${id}` body: `{ active: !active }` (toggle)
- `DELETE /api/recurring/${id}` (with confirm)
- `POST /api/transactions` body: `{ account_id, category_id, amount, type, date, note }` (payment logging)
- `PUT /api/recurring/${id}` body: `{ next_due }` (advance due date)
- `POST /api/recurring` body: `{ name, type, amount, frequency, next_due, account_id, category_id }`

### Log Payment Modal
- Title: 'Log Payment: {name}'
- Save text: 'Confirm & Log Payment'
- Shows item summary (name, current due, frequency)
- Fields: amount (autofocus), payment date, account (pre-selected), category (pre-selected), next due date (auto-calculated), memo (pre-filled: '{name} payment (Month Year)')
- Two-step process: 1) POST transaction 2) PUT recurring to advance next_due
- Validation: amount > 0

### Recurring/Subscription Modal
- Title: 'Add Monthly Subscription' (if isSubscription) or 'Add Recurring Rule'
- Quick Presets:
  - `#preset-monthly-sub-btn`: Sets type=expense, frequency=monthly, auto-selects subscription/entertainment category
  - `#preset-monthly-salary-btn`: Sets type=income, frequency=monthly, auto-selects salary/income category
  - Quick chips: Netflix, Spotify, YouTube Premium, Gym Membership, iCloud Storage, Internet/Wi-Fi
- Fields: name, type (expense/income), amount, frequency, next due date, account, category
- If `isSubscription`: auto-applies monthly subscription preset
- Validation: name required, amount > 0

### DOM Structure
- Header with `#add-subscription-btn` (repeat icon) + `#add-recurring-btn` (plus icon)
- Due Soon Banner (conditional): warning icon, count of items due within 7 days, total amount, link to `#deadlines`
- Filter card: `#rec-search`, `#rec-status-filter` (All/Active/Paused), `#rec-sort` (5 sort options)
- Data table: Name, Frequency, Account, Category, Arrival/Next Due (`#th-sort-due` clickable header), Status, Amount, Actions (Pay/Pause-Play/Delete)

### Cross-Page Links
`#deadlines` (from Due Soon banner)

### Due Soon Calculation
- Active items where next_due is between today and today+7 days
- Shows count and total amount

---

## 5. notifications.js (66 lines)

**Path**: `public/js/pages/notifications.js`
**Object**: `NotificationsPage`
**State**: `notifications: []`

### Methods
- `async render(container)`: Fetches notifications, renders card list.
- `attachEvents(container)`: Binds mark-all-read button.

### API Calls
- `GET /api/notifications`
- `POST /api/notifications/read-all`

### DOM Structure
- Header: "Alerts & Notifications" with `#mark-all-read-btn`
- Notification cards (or empty state "No notifications"):
  - 4px colored left border
  - Opacity: 0.7 if read, 1 if unread
  - Icon based on type:
    - alert: alert-circle, color danger
    - bill: file-text, color warning
    - milestone: trophy, color success
    - default: info, color info
  - Title, timestamp (created_at or 'Just now'), message body

### Event: Mark All Read
- Calls `API.post('/api/notifications/read-all')`
- Shows Toast 'All notifications marked as read'
- Re-renders page
- Calls `window.updateNotificationBadges()` (defined in app.js) to refresh sidebar/header badge counts

### No modals, no cross-links.

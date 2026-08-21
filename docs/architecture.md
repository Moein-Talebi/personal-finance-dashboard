# Personal Finance Dashboard — Architecture Reference

> **Purpose**: Single source of truth for making changes without re-reading source files.
> Last updated: 2026-08-18 (Comprehensive documentation suite created)

> [!IMPORTANT]
> **After EVERY set of changes, update this file and the relevant reference docs below.**

---

## Documentation Index

| Document | What It Covers |
|---|---|
| [architecture.md](./architecture.md) | This file - master overview, DB schema, API endpoints, cross-connections |
| [frontend-core-reference.md](./frontend-core-reference.md) | index.html, login.html, api.js, app.js, modal.js, toast.js |
| [pages-reference-part1.md](./pages-reference-part1.md) | dashboard.js, transactions.js, budget.js, accounts.js, goals.js, deadlines.js |
| [pages-reference-part2.md](./pages-reference-part2.md) | needs.js, debts.js, analytics.js, recurring.js, notifications.js |
| [backend-reference.md](./backend-reference.md) | server/index.js, db.js, api_handler.py, db.py, app.py, package.json |
| [styles-reference.md](./styles-reference.md) | CSS variables, classes, animations, breakpoints, theme system |
| [rules-and-conventions.md](./rules-and-conventions.md) | Coding rules, patterns, and mandatory conventions |

---

## Project Root

\\\
project/
├── docs/                       # Complete documentation suite
│   ├── architecture.md
│   ├── backend-reference.md
│   ├── frontend-core-reference.md
│   ├── pages-reference-part1.md
│   ├── pages-reference-part2.md
│   ├── rules-and-conventions.md
│   └── styles-reference.md
├── public/
│   ├── index.html              # Main SPA shell (Lucide wallet logo)
│   ├── login.html              # Auth page
│   ├── css/
│   │   └── styles.css          # 1,091 lines, full theme system
│   └── js/
│       ├── api.js              # API helper + global window.formatCurrency(val)
│       ├── app.js              # Router + auth guard + nav + notification badge poll
│       ├── components/
│       │   ├── modal.js        # Modal.open({ title, contentHTML, onSave, saveText })
│       │   └── toast.js        # Toast.show(message, type)
│       └── pages/
│           ├── dashboard.js    # Stat cards, charts, Upcoming Bills & Deadlines panels
│           ├── transactions.js # Ledger with filters & Euro modals
│           ├── budget.js       # Budget progress & categories
│           ├── accounts.js     # Wallet accounts & transfers
│           ├── goals.js        # Goals progress & contributions
│           ├── deadlines.js    # Auto-detected payments + custom deadlines
│           ├── needs.js        # 50/30/20 baseline needs calculator
│           ├── debts.js        # Debt tracker + installment logging & payoff history
│           ├── analytics.js    # Spending breakdown & comparisons
│           ├── recurring.js    # Subscriptions & bills + Pay advance + Due Soon banner
│           └── notifications.js# System alert & reminder list
├── server/
│   ├── index.js                # Node/Express backend (PRIMARY)
│   ├── db.js                   # SQLite schema init (better-sqlite3)
│   ├── api_handler.py          # Python backend (MUST STAY IN SYNC with index.js)
│   ├── db.py                   # Python SQLite schema (MUST STAY IN SYNC with db.js)
│   └── app.py                  # Python HTTP server entry
├── data/                       # SQLite database files
├── package.json
└── README.md
\\\

---

## Frontend Architecture

### Router (\pp.js\)
- Hash-based routing: \window.location.hash\ -> \#dashboard\, \#transactions\, etc.
- \
avigateTo(pageName)\ calls \pageObj.render(pageContainer)\
- After render, calls \lucide.createIcons()\
- Global Add Transaction button always available in topbar
- Notification badge polls \/api/notifications\ every 15 seconds

### Page Map
| Hash | Page Object | File |
|---|---|---|
| \#dashboard\ | \DashboardPage\ | \dashboard.js\ |
| \#transactions\ | \TransactionsPage\ | \	ransactions.js\ |
| \#budget\ | \BudgetPage\ | \udget.js\ |
| \#accounts\ | \AccountsPage\ | \ccounts.js\ |
| \#goals\ | \GoalsPage\ | \goals.js\ |
| \#deadlines\ | \DeadlinesPage\ | \deadlines.js\ |
| \#needs\ | \NeedsCalculatorPage\ | \
eeds.js\ |
| \#debts\ | \DebtTrackerPage\ | \debts.js\ |
| \#analytics\ | \AnalyticsPage\ | \nalytics.js\ |
| \#recurring\ | \RecurringPage\ | \ecurring.js\ |
| \#notifications\ | \NotificationsPage\ | \
otifications.js\ |

### Cross-Page Navigation
\\\html
<a href="#pagename">Link Text</a>
\\\

---

## API Helper (\pi.js\)
\\\js
API.get('/api/endpoint')
API.post('/api/endpoint', bodyObject)
API.put('/api/endpoint', bodyObject)
API.delete('/api/endpoint')

// Global currency formatting (Euro, de-DE):
window.formatCurrency(val)  // e.g. '€1.234,56' or '-€50,00'
\\\

---

## Component Patterns

### Modal (\modal.js\)
\\\js
Modal.open({
  title: 'Title',
  saveText: 'Save',
  contentHTML: \<form>...</form>\,
  onSave: async () => {
    return true;   // close modal
    return false;  // keep open (validation failed)
  }
});
\\\

### Toast (\	oast.js\)
\\\js
Toast.show('Message', 'success');  // success | warning | danger | info
\\\

### Lucide Icons
\\\html
<i data-lucide="icon-name"></i>
\\\
Auto-renders via \lucide.createIcons()\ after page render. Call manually after dynamic innerHTML.

---

## Currency Rule
> **ALWAYS use Euro (EUR) with de-DE locale formatting across ALL UI and code.**

## Emoji Rule
> **STRICT: Zero emojis anywhere in main app UI or code.**
> Replace with Lucide icons or styled HTML elements.

---

## Database Schema (9 tables)

> Full CREATE TABLE statements in [backend-reference.md](./backend-reference.md)

| Table | Key Columns | Notes |
|---|---|---|
| \accounts\ | id, name, type, balance, color | checking/savings/credit/cash/investment |
| \categories\ | id, name, type, expense_type, icon, color, budget_limit, rollover | fixed/variable/discretionary |
| \transactions\ | id, account_id, category_id, amount, type, date, note, target_account_id | income/expense/transfer |
| \recurring\ | id, name, account_id, category_id, amount, type, frequency, next_due, active | daily/weekly/bi-weekly/monthly/yearly |
| \goals\ | id, name, target_amount, current_amount, deadline, color | |
| \notifications\ | id, type, title, message, read | alert/info/milestone/bill |
| \debts\ | id, name, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color | \next_payment_date\ scoped to bank/installment loans (\interest_rate > 0\ or \minimum_payment > 0\). NULL for 0% personal borrowed money. |
| \debt_payments\ | id, debt_id, amount, date, account_id, note | FK cascade on debt delete |
| \deadlines\ | id, title, description, due_date, category, amount, status, priority | pending/completed/overdue |

---

## All API Endpoints

> Full route details with SQL queries in [backend-reference.md](./backend-reference.md)

### Dashboard & Analytics
| Method | Endpoint | Purpose |
|---|---|---|
| GET | \/api/dashboard\ | Full dashboard aggregates |
| GET | \/api/analytics\ | Category spending & history |
| GET | \/api/needs-calculator\ | 50/30/20 budget ratios |

### CRUD Resources
| Resource | GET | POST | PUT | DELETE | Special |
|---|---|---|---|---|---|
| \/api/accounts\ | List all | Create | Update :id | Delete :id | \POST /transfer\ |
| \/api/categories\ | List all | Create | Update :id | Delete :id | |
| \/api/transactions\ | List (filterable) | Create | - | Delete :id | \GET /export\ (CSV), \POST /import\ (CSV/Bulk) |
| \/api/recurring\ | List (with JOINs) | Create | Update :id | Delete :id | |
| \/api/goals\ | List all | Create | Update :id (or contribute) | Delete :id | |
| \/api/deadlines\ | List (auto-overdue) | Create | Update :id | Delete :id | \PUT :id/complete\ |
| \/api/debts\ | List (with payments) | Create | Update :id | Delete :id | \POST :id/payment\ (auto-advances next_payment_date for loans) |
| \/api/notifications\ | List (limit 50) | - | Mark :id read | - | \POST /read-all\ (triggers \checkDebtPaymentAlerts\) |

---

## Cross-Section Data Connections (Active)

| Source Data | Displayed In | Interaction |
|---|---|---|
| `recurring` (active bills) | **Dashboard** (Upcoming Bills panel) | Due date badges, link to `#recurring` |
| `recurring` (active bills) | **Deadlines** (Auto-Detected) | Pin button + link to `#recurring` |
| `recurring` (next 7 days) | **Recurring** (Due Soon Banner) | Count + total, link to `#deadlines` |
| `debts` (loans with `next_payment_date`) | **Deadlines** (Auto-Detected) | Scheduled installment due date + Pin + link to `#debts` |
| `debts` (loans upcoming/overdue) | **Notifications** | Auto-generates bill/alert notifications (3d before, due today, overdue) |
| `debts` (installment payment) | **Transactions Ledger** | Creates expense transaction in `transactions` with note `"Debt Payment: {name}"` |
| `debts` (installment payment) | **Accounts** | Deducts payment amount from `accounts.balance` |
| `debts` (installment payment) | **Budget & Categories** | Increases category spending, triggers `checkBudgetAlert` threshold warnings (80%/100%) |
| `debts` (installment payment) | **Notifications Badges** | Invokes `window.updateNotificationBadges()` to update real-time topbar/sidebar counters |
| `deadlines` (pending) | **Dashboard** (Deadlines panel) | Priority badges, link to `#deadlines` |
| `goals` (progress) | **Dashboard** (Goals widget) | Progress bars, link to `#goals` |
| `debts` (total balance) | **Dashboard** (Debt stat card) | Total amount, link to `#debts` |

---

## Backend Sync Rule
> **CRITICAL**: Both `server/index.js` (Node) and `server/api_handler.py` (Python) MUST be kept in sync.
> Any new endpoint or schema change must be added to both files and both `db.js` / `db.py`.

---

## Business Rules

### Balance & Debt Payment Management
- Income: `account.balance += amount`
- Expense: `account.balance -= amount`
- Transfer: source -= amount, target += amount
- Delete transaction: reverses the balance change
- Debt payment with account:
  1. Decreases debt `current_balance`
  2. Auto-advances `next_payment_date` by 1 month for loans (sets NULL if balance = 0)
  3. Inserts expense record into `transactions` with selected category
  4. Deducts amount from `account.balance`
  5. Triggers `checkBudgetAlert(category_id)` for budget warnings

### Budget Alerts
- On expense: checks category monthly spending
- >= 80%: creates warning notification
- >= 100%: creates exceeded notification

### Goal Milestones
- On contribution: if current >= target, creates milestone notification

### Deadline Auto-Update
- On GET /api/deadlines: pending items past due_date get updated to 'overdue'

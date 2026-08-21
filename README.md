# Personal Finance Dashboard

A comprehensive, modular personal finance web application built for complete financial visibility and control. Track income, expenses, category budgets, multi-wallet accounts, savings goals, financial deadlines, debts with installment history, recurring subscriptions, and 50/30/20 budget ratios.

---

## Key Features

### 1. Unified Financial Dashboard
- **Real-Time Key Metrics**: Net worth, monthly income, monthly expenses, and total debt owed.
- **Visual Money Flow**: Interactive bar charts (Income vs Expense) and category distribution donut charts.
- **Cross-Connected Panels**: Live feeds for upcoming bills/subscriptions, pending deadlines with priority tags, recent transaction ledger, and savings goal progress.

### 2. Connected Financial Deadlines Manager
- **Auto-Detected Obligations**: Live synchronization from active recurring subscriptions and monthly debt installment schedules.
- **1-Click Pinning**: Convert auto-detected bills or custom obligations directly into pinned deadlines.
- **Priority & Status Tracking**: High/Medium/Low priority tags and automatic overdue status detection.

### 3. Debt Tracker & Installment Log
- **Borrowed Money & Bank Loans**: Quick setup presets for 0% personal loans from friends and interest-bearing bank loans.
- **Monthly Payment Dates & Auto-Advance**: Scoped next payment date tracking and auto-advancing 1-month schedules for bank/installment loans, with upcoming and overdue alert notifications.
- **Partial Payoff History & Account Deductions**: Log individual installment payments with automatic source bank account balance deductions, transaction ledger records, and expandable payment logs.
- **Visual Payoff Progress**: Real-time progress bars showing total paid down vs remaining balance.

### 4. Recurring Bills & Subscriptions
- **Smart Due Date Arithmetic**: Supports Daily, Weekly, Bi-Weekly, Monthly, and Yearly recurring schedules.
- **Pay in Advance**: Log payments and automatically advance the next due date while generating ledger entries.
- **Due Soon Alerts**: Warning banner for all payments arriving in the next 7 days with quick links to deadlines.
- **Quick Presets**: Pre-configured chips for Netflix, Spotify, YouTube Premium, Gym, iCloud, Wi-Fi, and Monthly Salary.

### 5. Category Budgets & 50/30/20 Needs Calculator
- **Budget Limits & Warnings**: Visual gauge progress bars with automated threshold alerts (80% warning, 100% budget exceeded).
- **Expense Classification**: Fixed Needs, Variable Expenses, and Discretionary Wants.
- **Survival Baseline Calculator**: Computes exact baseline survival costs and compares actual spending to the 50/30/20 financial rule.

### 6. Multi-Wallet Accounts & Transfers
- **Card Formats**: Checking, Savings, Credit Cards, Cash Wallets, and Investments with customizable colors and gradient themes.
- **Internal Transfers**: Move funds between accounts with atomic balance updates and transaction records.

### 7. Interactive Analytics & Ledger
- **Spending Trends**: 6-month historical income vs expense comparison and top category spending ledger.
- **Full Transaction Ledger**: Search, filter by account/category/type, active filter tags, CSV export, and intelligent multi-language CSV upload & import with live preview.

---

## Design & Standards

- **Standard Currency**: Euro (€) formatted according to German locale standards (de-DE, e.g. 1.234,56 €).
- **Clean UI**: Strict zero-emoji policy; built exclusively with Lucide icons and clean CSS elements.
- **Theme Support**: Fully integrated Light and Dark mode with animated theme switching and CSS variables.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 Custom Properties, Chart.js, Lucide Icons |
| **Backend (Primary)** | Node.js + Express (server/index.js, server/db.js) |
| **Backend (Secondary)** | Python 3 Standard Library HTTP Server (server/app.py, server/api_handler.py, server/db.py) |
| **Database** | SQLite with WAL mode (data/budget.db) |

---

## Quick Start

### Option A: Running with Node.js (Recommended)

1. **Install dependencies**:
   \\\ash
   npm install
   \\\

2. **Start the server**:
   \\\ash
   npm start
   \\\

3. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### Option B: Running with Python

1. **Start the Python server**:
   \\\ash
   python -m server.app
   \\\

2. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation Suite

Detailed architecture and code reference documentation is available in the [docs/](./docs) folder:

- [**docs/architecture.md**](./docs/architecture.md) — Master architecture overview, database schema, and cross-section connections.
- [**docs/frontend-core-reference.md**](./docs/frontend-core-reference.md) — Reference for index.html, login.html, pi.js, pp.js, modal.js, and 	oast.js.
- [**docs/pages-reference-part1.md**](./docs/pages-reference-part1.md) — Reference for Dashboard, Transactions, Budget, Accounts, Goals, and Deadlines.
- [**docs/pages-reference-part2.md**](./docs/pages-reference-part2.md) — Reference for Needs Calculator, Debts, Analytics, Recurring, and Notifications.
- [**docs/backend-reference.md**](./docs/backend-reference.md) — Complete endpoint, SQL query, and dual-backend synchronization reference.
- [**docs/styles-reference.md**](./docs/styles-reference.md) — CSS variables, class catalog, animation keyframes, and responsive breakpoints.
- [**docs/rules-and-conventions.md**](./docs/rules-and-conventions.md) — Code patterns, standards, and mandatory developer rules.

---

## Author

- **Moein Talebi**

---

## License

This project is licensed under the [MIT License](./LICENSE).

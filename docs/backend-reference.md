# Backend Reference

> **Purpose**: Complete reference for all backend server files. Use this instead of reading source files.
> Last updated: 2026-08-18

---

## Dual Backend Architecture

The project has TWO backend implementations that MUST stay in sync:
1. **Node/Express** (`server/index.js` + `server/db.js`) - PRIMARY
2. **Python stdlib HTTP** (`server/app.py` + `server/api_handler.py` + `server/db.py`)

Both connect to the same SQLite database at `data/budget.db`.

---

## 1. package.json (16 lines)

**Path**: `package.json`

```json
{
  "name": "budget-app",
  "version": "1.0.0",
  "description": "Modular Personal Budgeting Web App",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node server/index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.0",
    "cors": "^2.8.5",
    "express": "^4.21.2"
  }
}
```

---

## 2. server/db.js - Node SQLite Schema (199 lines)

**Path**: `server/db.js`

### Imports
- `better-sqlite3`, `path`, `fs`

### Database Setup
- Data directory: `path.join(__dirname, '..', 'data')` (auto-created)
- Database file: `data/budget.db`
- PRAGMAs: `journal_mode = WAL`, `foreign_keys = ON`

### Tables (9 total) - Exact CREATE TABLE statements:

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance REAL DEFAULT 0.0,
  color TEXT DEFAULT '#7C3AED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  expense_type TEXT DEFAULT 'variable',
  icon TEXT DEFAULT 'tag',
  color TEXT DEFAULT '#4F46E5',
  budget_limit REAL DEFAULT 0.0,
  rollover INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT DEFAULT '',
  is_recurring INTEGER DEFAULT 0,
  target_account_id INTEGER,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  next_due TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0.0,
  deadline TEXT NOT NULL,
  color TEXT DEFAULT '#10B981',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_amount REAL NOT NULL,
  current_balance REAL NOT NULL,
  interest_rate REAL DEFAULT 0.0,
  minimum_payment REAL DEFAULT 0.0,
  due_day INTEGER DEFAULT 1,
  color TEXT DEFAULT '#EF4444',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  account_id INTEGER,
  note TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  amount REAL DEFAULT 0.0,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Schema Migration
- Checks `PRAGMA table_info(categories)` for `expense_type` column
- If missing: `ALTER TABLE categories ADD COLUMN expense_type TEXT DEFAULT 'variable'`

### Seed Data (triggered when accounts table is empty)
- 4 accounts: Main Checking (4250), High Yield Savings (12800), Rewards Credit Card (-640.50), Cash Wallet (180)
- 8 categories with budget limits and expense types
- 8 sample transactions with dynamic dates
- 4 recurring rules (rent, salary, netflix, internet)
- 3 goals (emergency fund, japan trip, laptop)
- 3 notifications
- 2 debts (auto loan, student loan)
- 3 deadlines

### Export
`module.exports = db;`

---

## 3. server/index.js - Node/Express API (651 lines)

**Path**: `server/index.js`

### Setup
- Port: `3000`
- Middlewares: `cors()`, `express.json()`, `express.static(PUBLIC_DIR)`
- SPA fallback: `app.get('*', ...)` serves `index.html`

### Helper Functions
```javascript
queryAll(sql, params = [])   // db.prepare(sql).all(...params)
queryOne(sql, params = [])   // db.prepare(sql).get(...params)
executeSql(sql, params = []) // db.prepare(sql).run(...params), returns lastInsertRowid

checkBudgetAlert(categoryId)
// Queries category budget_limit
// Calculates month spending: SUM(amount) WHERE category_id AND type='expense' AND date LIKE 'YYYY-MM%'
// If >= 100%: inserts 'Budget Exceeded' notification
// If >= 80%: inserts 'Budget Warning' notification

getAnalyticsData()
// Current month category spending grouped by category
// Top 5 categories by total
// Last 6 months income/expense history
```

### All API Routes

#### GET /api/dashboard
Aggregates: net_worth (sum of account balances), total_debt (sum of debt current_balance), month_income, month_expense, month_savings, budget totals, recent 6 transactions (with JOINs), upcoming 4 bills (active recurring expenses), upcoming 4 deadlines (pending), top 3 goals, category_spending, monthly_history.

#### GET /api/analytics
Returns category_spending, top_categories, monthly_history via getAnalyticsData().

#### GET /api/needs-calculator
Calculates 50/30/20 budget ratios: expected_income, survival_cost, fixed_needs, variable_wants, debt_minimums, total_needed, net_gap, ratios (needs_pct, wants_pct, savings_pct, rec_needs_pct=50, rec_wants_pct=30, rec_savings_pct=20), categories list.

#### Accounts CRUD
- GET /api/accounts -> SELECT * ORDER BY id ASC
- POST /api/accounts -> INSERT {name, type, balance, color}
- PUT /api/accounts/:id -> UPDATE {name, type, balance, color}
- DELETE /api/accounts/:id -> DELETE (cascades)

#### Categories CRUD
- GET /api/categories -> SELECT * ORDER BY name ASC
- POST /api/categories -> INSERT {name, type, expense_type, icon, color, budget_limit, rollover}
- PUT /api/categories/:id -> UPDATE same fields
- DELETE /api/categories/:id -> DELETE

#### Transactions CRUD + Export
- GET /api/transactions/export -> CSV download (Content-Disposition: attachment)
- GET /api/transactions -> Dynamic WHERE with filters: account_id, category_id, type, start_date, end_date
- POST /api/transactions -> INSERT + balance update:
  - income: account balance += amount
  - expense: account balance -= amount, checkBudgetAlert()
  - transfer: source -= amount, target += amount
- DELETE /api/transactions/:id -> DELETE + reverse balance change

#### Recurring CRUD
- GET /api/recurring -> SELECT with JOINs (account_name, category_name, category_icon) ORDER BY next_due ASC
- POST /api/recurring -> INSERT {name, account_id, category_id, amount, type, frequency, next_due}
- PUT /api/recurring/:id -> UPDATE (falls back to existing values for missing fields)
- DELETE /api/recurring/:id -> DELETE

#### Goals CRUD
- GET /api/goals -> SELECT * ORDER BY deadline ASC
- POST /api/goals -> INSERT {name, target_amount, current_amount, deadline, color}
- PUT /api/goals/:id -> Two branches:
  - If `contribution` in body: adds to current_amount, checks if goal completed (creates milestone notification)
  - Else: full field update
- DELETE /api/goals/:id -> DELETE

#### Deadlines CRUD
- GET /api/deadlines -> SELECT * ORDER BY due_date ASC, auto-updates overdue items
- POST /api/deadlines -> INSERT {title, description, due_date, category, amount, priority}
- PUT /api/deadlines/:id -> UPDATE all fields including status
- PUT /api/deadlines/:id/complete -> UPDATE status='completed'
- DELETE /api/deadlines/:id -> DELETE

#### Debts CRUD + Payments
- GET /api/debts -> SELECT * ORDER BY current_balance DESC, with nested payments[] per debt
- POST /api/debts -> INSERT {name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color}
- PUT /api/debts/:id -> UPDATE same fields
- PUT/POST /api/debts/:id/payment -> Business logic:
  1. UPDATE debts SET current_balance = MAX(0, current_balance - amount)
  2. INSERT INTO debt_payments
  3. If account_id provided: creates expense transaction + deducts account balance
- DELETE /api/debts/:id -> DELETE (cascades payments)

#### Notifications
- GET /api/notifications -> SELECT * ORDER BY id DESC LIMIT 50
- PUT /api/notifications/:id/read -> UPDATE read=1
- POST /api/notifications/read-all -> UPDATE read=1 for all

### Server Startup
`app.listen(3000)` -> logs 'FinSet Express App Server running on http://localhost:3000'

---

## 4. server/db.py - Python SQLite Schema (244 lines)

**Path**: `server/db.py`

Mirrors `db.js` exactly. Same 9 tables, same seed data, same migration check.

### Key Differences from db.js
- Uses `sqlite3` stdlib module
- `conn.row_factory = sqlite3.Row` for dict-like access
- `conn.execute('PRAGMA foreign_keys = ON')`
- Helper functions: `get_db()`, `query_all(query, args=())`, `query_one(query, args=())`, `execute_sql(query, args=())`
- Each helper opens and closes its own connection

---

## 5. server/app.py - Python HTTP Entry (122 lines)

**Path**: `server/app.py`

Uses stdlib `http.server.HTTPServer` with custom handler (NOT Flask despite the filename).

### BudgetAppHandler
- `do_GET()`: API routes -> `handle_api_request('GET', ...)`, static files -> serves from PUBLIC_DIR with SPA fallback
- `do_POST()`: API routes -> reads JSON body -> `handle_api_request('POST', ...)`
- `do_PUT()`: API routes -> reads JSON body -> `handle_api_request('PUT', ...)`
- `do_DELETE()`: API routes -> `handle_api_request('DELETE', ...)`
- `do_OPTIONS()`: CORS preflight (Allow-Origin: *, Allow-Methods: GET/POST/PUT/DELETE/OPTIONS)
- `_read_json_body()`: reads Content-Length bytes, parses JSON
- `_send_api_response(res)`: handles JSON and CSV responses with CORS headers

### Server Start
`HTTPServer(('0.0.0.0', 3000), BudgetAppHandler).serve_forever()`

---

## 6. server/api_handler.py - Python Route Logic (582 lines)

**Path**: `server/api_handler.py`

Mirrors `server/index.js` route logic exactly. Same endpoints, same SQL, same business rules.

### URL Dispatcher
```python
def handle_api_request(method, path, body, query_params):
    parts = path.strip('/').split('/')
    resource = parts[1]  # e.g. 'dashboard', 'debts'
    resource_id = int(parts[2]) if parts[2].isdigit()
    action = parts[3] or parts[2] if non-digit  # e.g. 'payment', 'complete', 'export'
```

### Helper Functions
- `check_budget_alert(category_id)`: Same 80%/100% budget threshold logic
- `get_dashboard_summary()`: Same aggregate queries
- `get_analytics_data()`: Same category + history queries
- `get_needs_calculator_data()`: Same 50/30/20 calculation

### Response Format
All routes return: `{"status": int, "data": ...}` or `{"status": int, "content_type": "text/csv", "raw": csv_string}`

---

## Business Rules (Both Backends)

### Balance Management
- Income transaction: `account.balance += amount`
- Expense transaction: `account.balance -= amount`
- Transfer: `source.balance -= amount`, `target.balance += amount`
- Delete transaction: reverses the above
- Debt payment with account: creates expense transaction + deducts balance

### Budget Alerts
- On expense transaction: checks category monthly spending
- >= 80% of budget_limit: creates 'Budget Warning' notification
- >= 100% of budget_limit: creates 'Budget Exceeded' notification

### Goal Milestones
- On contribution: if current_amount >= target_amount, creates 'Goal Completed!' milestone notification

### Deadline Auto-Update
- On GET /api/deadlines: any item with due_date < today AND status='pending' gets updated to status='overdue'

### Debt Payment Flow
1. Reduce debt current_balance by payment amount (min 0)
2. Record in debt_payments table
3. If paying from account: create expense transaction + reduce account balance

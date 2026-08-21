const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'budget.db');
const db = new Database(dbPath);

// Enable Foreign Keys & Write-Ahead Logging for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- checking, savings, credit, cash, investment
      balance REAL DEFAULT 0.0,
      color TEXT DEFAULT '#7C3AED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense', -- expense, income
      expense_type TEXT DEFAULT 'variable', -- fixed, variable, discretionary
      icon TEXT DEFAULT 'tag',
      color TEXT DEFAULT '#4F46E5',
      budget_limit REAL DEFAULT 0.0,
      rollover INTEGER DEFAULT 0 -- 0 = false, 1 = true
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL, -- income, expense, transfer
      date TEXT NOT NULL, -- YYYY-MM-DD
      note TEXT DEFAULT '',
      is_recurring INTEGER DEFAULT 0,
      target_account_id INTEGER, -- used for transfer type
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      account_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL, -- income, expense
      frequency TEXT NOT NULL, -- daily, weekly, bi-weekly, monthly, yearly
      next_due TEXT NOT NULL, -- YYYY-MM-DD
      active INTEGER DEFAULT 1,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0.0,
      deadline TEXT NOT NULL, -- YYYY-MM-DD
      color TEXT DEFAULT '#10B981',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- alert, info, milestone, bill
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'borrowed', -- borrowed (I owe), lent (someone owes me)
      total_amount REAL NOT NULL,
      current_balance REAL NOT NULL,
      interest_rate REAL DEFAULT 0.0,
      minimum_payment REAL DEFAULT 0.0,
      due_day INTEGER DEFAULT 1,
      next_payment_date TEXT DEFAULT NULL,
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
      category TEXT DEFAULT 'custom', -- bill, goal, debt, tax, custom
      amount REAL DEFAULT 0.0,
      status TEXT DEFAULT 'pending', -- pending, completed, overdue
      priority TEXT DEFAULT 'medium', -- low, medium, high
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure category tables have expense_type column
  const tableInfo = db.prepare("PRAGMA table_info(categories)").all();
  const hasExpenseType = tableInfo.some(col => col.name === 'expense_type');
  if (!hasExpenseType) {
    db.exec("ALTER TABLE categories ADD COLUMN expense_type TEXT DEFAULT 'variable';");
  }

  // Ensure debts table has next_payment_date column
  const debtInfo = db.prepare("PRAGMA table_info(debts)").all();
  const hasNextPaymentDate = debtInfo.some(col => col.name === 'next_payment_date');
  if (!hasNextPaymentDate) {
    db.exec("ALTER TABLE debts ADD COLUMN next_payment_date TEXT DEFAULT NULL;");
  }

  // Ensure debts table has type column (borrowed vs lent)
  const hasType = debtInfo.some(col => col.name === 'type');
  if (!hasType) {
    db.exec("ALTER TABLE debts ADD COLUMN type TEXT DEFAULT 'borrowed';");
    db.exec("UPDATE debts SET type = 'borrowed' WHERE type IS NULL;");
  }

  // Clear next_payment_date for non-loan borrowed money (0% interest & 0 min payment)
  db.exec("UPDATE debts SET next_payment_date = NULL WHERE (interest_rate IS NULL OR interest_rate = 0) AND (minimum_payment IS NULL OR minimum_payment = 0);");

  // Auto-populate next_payment_date for existing loan debts if null
  const debtsWithoutDate = db.prepare("SELECT id, due_day FROM debts WHERE next_payment_date IS NULL AND current_balance > 0 AND (interest_rate > 0 OR minimum_payment > 0)").all();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  debtsWithoutDate.forEach(d => {
    const dueDay = Math.min(Math.max(parseInt(d.due_day, 10) || 1, 1), 28);
    let target = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (target.toISOString().split('T')[0] < todayStr) {
      target = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
    const dateStr = target.toISOString().split('T')[0];
    db.prepare("UPDATE debts SET next_payment_date = ? WHERE id = ?").run(dateStr, d.id);
  });

  seedDefaultData();
}

function seedDefaultData() {
  const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;
  if (accountCount === 0) {
    const insertAccount = db.prepare('INSERT INTO accounts (name, type, balance, color) VALUES (?, ?, ?, ?)');
    insertAccount.run('Main Checking', 'checking', 4250.00, '#6E54FF');
    insertAccount.run('High Yield Savings', 'savings', 12800.00, '#10B981');
    insertAccount.run('Rewards Credit Card', 'credit', -640.50, '#EF4444');
    insertAccount.run('Cash Wallet', 'cash', 180.00, '#F59E0B');

    const insertCategory = db.prepare('INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertCategory.run('Housing & Rent', 'expense', 'fixed', 'home', '#3B82F6', 1500.00, 0);
    insertCategory.run('Groceries & Food', 'expense', 'variable', 'shopping-bag', '#10B981', 600.00, 1);
    insertCategory.run('Dining Out', 'expense', 'discretionary', 'utensils', '#F59E0B', 300.00, 0);
    insertCategory.run('Transportation', 'expense', 'variable', 'car', '#8B5CF6', 250.00, 0);
    insertCategory.run('Entertainment & Subscriptions', 'expense', 'discretionary', 'tv', '#EC4899', 150.00, 0);
    insertCategory.run('Utilities & Internet', 'expense', 'fixed', 'zap', '#06B6D4', 200.00, 0);
    insertCategory.run('Salary & Income', 'income', 'variable', 'briefcase', '#10B981', 0, 0);
    insertCategory.run('Freelance & Side Business', 'income', 'variable', 'dollar-sign', '#6366F1', 0, 0);

    const today = new Date().toISOString().split('T')[0];
    const prevMonth = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0];
    const earlierMonth = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const insertTx = db.prepare('INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (?, ?, ?, ?, ?, ?)');
    insertTx.run(1, 7, 5200.00, 'income', earlierMonth, 'Monthly Salary Direct Deposit');
    insertTx.run(1, 1, 1500.00, 'expense', earlierMonth, 'Apartment Rent Payment');
    insertTx.run(3, 2, 142.30, 'expense', prevMonth, 'Trader Joe\'s Grocery Run');
    insertTx.run(3, 3, 45.80, 'expense', prevMonth, 'Sushi Dinner');
    insertTx.run(1, 4, 65.00, 'expense', prevMonth, 'Gas station refill');
    insertTx.run(3, 5, 18.99, 'expense', prevMonth, 'Netflix Premium');
    insertTx.run(1, 2, 88.40, 'expense', today, 'Weekly Groceries');
    insertTx.run(3, 3, 32.50, 'expense', today, 'Lunch with team');

    const insertRecurring = db.prepare('INSERT INTO recurring (name, account_id, category_id, amount, type, frequency, next_due, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insertRecurring.run('Monthly Rent', 1, 1, 1500.00, 'expense', 'monthly', '2026-09-01', 1);
    insertRecurring.run('Salary Deposit', 1, 7, 5200.00, 'income', 'monthly', '2026-08-31', 1);
    insertRecurring.run('Netflix Subscription', 3, 5, 18.99, 'expense', 'monthly', '2026-08-20', 1);
    insertRecurring.run('Internet Bill', 1, 6, 79.99, 'expense', 'monthly', '2026-08-25', 1);

    const insertGoal = db.prepare('INSERT INTO goals (name, target_amount, current_amount, deadline, color) VALUES (?, ?, ?, ?, ?)');
    insertGoal.run('Emergency Fund', 10000.00, 7500.00, '2026-12-31', '#10B981');
    insertGoal.run('Japan Summer Trip', 4500.00, 2100.00, '2027-06-15', '#3B82F6');
    insertGoal.run('New Laptop', 2000.00, 1400.00, '2026-11-01', '#8B5CF6');

    const insertNotif = db.prepare('INSERT INTO notifications (type, title, message, read) VALUES (?, ?, ?, ?)');
    insertNotif.run('info', 'Welcome to FinSet!', 'Your personal finance workspace is set up and ready to track.', 0);
    insertNotif.run('bill', 'Upcoming Bill Reminder', 'Netflix Subscription ($18.99) is due in 8 days.', 0);
    insertNotif.run('milestone', 'Goal Milestone Achieved', 'Emergency Fund has reached 75% of target goal!', 0);

    const insertDebt = db.prepare('INSERT INTO debts (name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertDebt.run('Auto Loan (Honda Civic)', 18000.00, 9400.00, 5.2, 320.00, 15, '#EF4444');
    insertDebt.run('Student Loan', 12000.00, 4800.00, 4.5, 180.00, 28, '#F59E0B');

    const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const next14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const insertDeadline = db.prepare('INSERT INTO deadlines (title, description, due_date, category, amount, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertDeadline.run('Netflix Subscription Payment', 'Monthly auto-pay on credit card', next7, 'bill', 18.99, 'pending', 'medium');
    insertDeadline.run('Car Loan Payment Due', 'Monthly auto financing minimum payment', next14, 'debt', 320.00, 'pending', 'high');
    insertDeadline.run('Emergency Fund Goal Target', 'Hit $10,000 baseline savings', '2026-12-31', 'goal', 10000.00, 'pending', 'low');
  }
}

initSchema();

module.exports = db;

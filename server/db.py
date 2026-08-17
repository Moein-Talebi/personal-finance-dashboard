import sqlite3
import os
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, 'budget.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
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
        total_amount REAL NOT NULL,
        current_balance REAL NOT NULL,
        interest_rate REAL DEFAULT 0.0,
        minimum_payment REAL DEFAULT 0.0,
        due_day INTEGER DEFAULT 1,
        color TEXT DEFAULT '#EF4444',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    """)

    # Alter categories table if expense_type column missing from earlier schema
    cursor.execute("PRAGMA table_info(categories);")
    cols = [r['name'] for r in cursor.fetchall()]
    if 'expense_type' not in cols:
        cursor.execute("ALTER TABLE categories ADD COLUMN expense_type TEXT DEFAULT 'variable';")

    # Upgrade existing DB data if needed
    cursor.execute("UPDATE categories SET expense_type = 'fixed' WHERE name IN ('Housing & Rent', 'Utilities & Internet');")
    cursor.execute("UPDATE categories SET expense_type = 'discretionary' WHERE name IN ('Dining Out', 'Entertainment & Subscriptions');")
    cursor.execute("UPDATE categories SET expense_type = 'variable' WHERE name IN ('Groceries & Food', 'Transportation');")

    cursor.execute("SELECT COUNT(*) as count FROM debts;")
    if cursor.fetchone()['count'] == 0:
        cursor.execute("INSERT INTO debts (name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color) VALUES ('Auto Loan (Honda Civic)', 18000.00, 9400.00, 5.2, 320.00, 15, '#EF4444');")
        cursor.execute("INSERT INTO debts (name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color) VALUES ('Student Loan', 12000.00, 4800.00, 4.5, 180.00, 28, '#F59E0B');")

    cursor.execute("SELECT COUNT(*) as count FROM deadlines;")
    if cursor.fetchone()['count'] == 0:
        today_dt = datetime.now()
        next7 = (today_dt + timedelta(days=7)).strftime('%Y-%m-%d')
        next14 = (today_dt + timedelta(days=14)).strftime('%Y-%m-%d')
        cursor.execute("INSERT INTO deadlines (title, description, due_date, category, amount, status, priority) VALUES ('Netflix Subscription Payment', 'Monthly auto-pay on credit card', ?, 'bill', 18.99, 'pending', 'medium');", (next7,))
        cursor.execute("INSERT INTO deadlines (title, description, due_date, category, amount, status, priority) VALUES ('Car Loan Payment Due', 'Monthly auto financing minimum payment', ?, 'debt', 320.00, 'pending', 'high');", (next14,))
        cursor.execute("INSERT INTO deadlines (title, description, due_date, category, amount, status, priority) VALUES ('Emergency Fund Goal Target', 'Hit $10,000 baseline savings', '2026-12-31', 'goal', 10000.00, 'pending', 'low');")

    conn.commit()
    seed_default_data(conn)
    conn.close()

def seed_default_data(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM accounts;")
    if cursor.fetchone()['count'] == 0:
        # Accounts
        cursor.execute("INSERT INTO accounts (name, type, balance, color) VALUES ('Main Checking', 'checking', 4250.00, '#7C3AED');")
        cursor.execute("INSERT INTO accounts (name, type, balance, color) VALUES ('High Yield Savings', 'savings', 12800.00, '#10B981');")
        cursor.execute("INSERT INTO accounts (name, type, balance, color) VALUES ('Rewards Credit Card', 'credit', -640.50, '#EF4444');")
        cursor.execute("INSERT INTO accounts (name, type, balance, color) VALUES ('Cash Wallet', 'cash', 180.00, '#F59E0B');")

        # Categories
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Housing & Rent', 'expense', 'fixed', 'home', '#3B82F6', 1500.00, 0);")
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Groceries & Food', 'expense', 'variable', 'shopping-bag', '#10B981', 600.00, 1);")
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Dining Out', 'expense', 'discretionary', 'utensils', '#F59E0B', 300.00, 0);")
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Transportation', 'expense', 'variable', 'car', '#8B5CF6', 250.00, 0);")
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Entertainment & Subscriptions', 'expense', 'discretionary', 'tv', '#EC4899', 150.00, 0);")
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Utilities & Internet', 'expense', 'fixed', 'zap', '#06B6D4', 200.00, 0);")
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Salary & Income', 'income', 'variable', 'briefcase', '#10B981', 0, 0);")
        cursor.execute("INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES ('Freelance & Side Business', 'income', 'variable', 'dollar-sign', '#6366F1', 0, 0);")

        # Dates
        today_dt = datetime.now()
        today = today_dt.strftime('%Y-%m-%d')
        prev15 = (today_dt - timedelta(days=15)).strftime('%Y-%m-%d')
        prev30 = (today_dt - timedelta(days=30)).strftime('%Y-%m-%d')
        next7 = (today_dt + timedelta(days=7)).strftime('%Y-%m-%d')
        next14 = (today_dt + timedelta(days=14)).strftime('%Y-%m-%d')

        # Transactions
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (1, 7, 5200.00, 'income', ?, 'Monthly Salary Direct Deposit');", (prev30,))
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (1, 1, 1500.00, 'expense', ?, 'Apartment Rent Payment');", (prev30,))
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (3, 2, 142.30, 'expense', ?, 'Trader Joe''s Grocery Run');", (prev15,))
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (3, 3, 45.80, 'expense', ?, 'Sushi Dinner');", (prev15,))
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (1, 4, 65.00, 'expense', ?, 'Gas station refill');", (prev15,))
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (3, 5, 18.99, 'expense', ?, 'Netflix Premium');", (prev15,))
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (1, 2, 88.40, 'expense', ?, 'Weekly Groceries');", (today,))
        cursor.execute("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (3, 3, 32.50, 'expense', ?, 'Lunch with team');", (today,))

        # Recurring
        cursor.execute("INSERT INTO recurring (name, account_id, category_id, amount, type, frequency, next_due, active) VALUES ('Monthly Rent', 1, 1, 1500.00, 'expense', 'monthly', '2026-09-01', 1);")
        cursor.execute("INSERT INTO recurring (name, account_id, category_id, amount, type, frequency, next_due, active) VALUES ('Salary Deposit', 1, 7, 5200.00, 'income', 'monthly', '2026-08-31', 1);")
        cursor.execute("INSERT INTO recurring (name, account_id, category_id, amount, type, frequency, next_due, active) VALUES ('Netflix Subscription', 3, 5, 18.99, 'expense', 'monthly', '2026-08-20', 1);")
        cursor.execute("INSERT INTO recurring (name, account_id, category_id, amount, type, frequency, next_due, active) VALUES ('Internet Bill', 1, 6, 79.99, 'expense', 'monthly', '2026-08-25', 1);")

        # Goals
        cursor.execute("INSERT INTO goals (name, target_amount, current_amount, deadline, color) VALUES ('Emergency Fund', 10000.00, 7500.00, '2026-12-31', '#10B981');")
        cursor.execute("INSERT INTO goals (name, target_amount, current_amount, deadline, color) VALUES ('Japan Summer Trip', 4500.00, 2100.00, '2027-06-15', '#3B82F6');")
        cursor.execute("INSERT INTO goals (name, target_amount, current_amount, deadline, color) VALUES ('New Laptop', 2000.00, 1400.00, '2026-11-01', '#8B5CF6');")

        # Debts
        cursor.execute("INSERT INTO debts (name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color) VALUES ('Auto Loan (Honda Civic)', 18000.00, 9400.00, 5.2, 320.00, 15, '#EF4444');")
        cursor.execute("INSERT INTO debts (name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color) VALUES ('Student Loan', 12000.00, 4800.00, 4.5, 180.00, 28, '#F59E0B');")

        # Deadlines
        cursor.execute("INSERT INTO deadlines (title, description, due_date, category, amount, status, priority) VALUES ('Netflix Subscription Payment', 'Monthly auto-pay on credit card', ?, 'bill', 18.99, 'pending', 'medium');", (next7,))
        cursor.execute("INSERT INTO deadlines (title, description, due_date, category, amount, status, priority) VALUES ('Car Loan Payment Due', 'Monthly auto financing minimum payment', ?, 'debt', 320.00, 'pending', 'high');", (next14,))
        cursor.execute("INSERT INTO deadlines (title, description, due_date, category, amount, status, priority) VALUES ('Emergency Fund Goal Target', 'Hit $10,000 baseline savings', '2026-12-31', 'goal', 10000.00, 'pending', 'low');")

        # Notifications
        cursor.execute("INSERT INTO notifications (type, title, message, read) VALUES ('info', 'Welcome to BudgetApp!', 'Your personal finance server is set up and ready to track.', 0);")
        cursor.execute("INSERT INTO notifications (type, title, message, read) VALUES ('bill', 'Upcoming Bill Reminder', 'Netflix Subscription ($18.99) is due in 7 days.', 0);")
        cursor.execute("INSERT INTO notifications (type, title, message, read) VALUES ('milestone', 'Goal Milestone Achieved', 'Emergency Fund has reached 75% of target goal!', 0);")

        conn.commit()

def query_all(query, args=()):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, args)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def query_one(query, args=()):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, args)
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def execute_sql(query, args=()):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, args)
    conn.commit()
    last_id = cursor.lastrowid
    conn.close()
    return last_id

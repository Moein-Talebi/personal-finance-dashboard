const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Helper SQL runner methods
const queryAll = (sql, params = []) => db.prepare(sql).all(...params);
const queryOne = (sql, params = []) => db.prepare(sql).get(...params);
const executeSql = (sql, params = []) => {
  const info = db.prepare(sql).run(...params);
  return info.lastInsertRowid;
};

// Alert check
function checkBudgetAlert(categoryId) {
  const cat = queryOne("SELECT * FROM categories WHERE id = ?", [categoryId]);
  if (!cat || cat.budget_limit <= 0) return;

  const currentMonth = new Date().toISOString().substring(0, 7);
  const totalSpent = queryOne(`
    SELECT COALESCE(SUM(amount), 0) as spent 
    FROM transactions 
    WHERE category_id = ? AND type = 'expense' AND date LIKE ?;
  `, [categoryId, `${currentMonth}%`]).spent;

  const limit = cat.budget_limit;
  const pct = (totalSpent / limit) * 100;
  if (pct >= 100) {
    executeSql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Budget Exceeded', ?)",
      [`You have exceeded your budget for ${cat.name} ($${totalSpent.toFixed(2)} / $${limit.toFixed(2)})`]
    );
  } else if (pct >= 80) {
    executeSql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Budget Warning (80%)', ?)",
      [`You have reached ${pct.toFixed(0)}% of your budget for ${cat.name}`]
    );
  }
}

// 1. Dashboard summary
app.get('/api/dashboard', (req, res) => {
  const accts = queryAll("SELECT balance FROM accounts;");
  const totalAssets = accts.reduce((sum, a) => sum + (a.balance > 0 ? a.balance : 0), 0);
  const debts = queryAll("SELECT current_balance, type FROM debts;");
  const totalDebt = debts.filter(d => (d.type || 'borrowed') === 'borrowed').reduce((sum, d) => sum + d.current_balance, 0);
  const totalReceivables = debts.filter(d => d.type === 'lent').reduce((sum, d) => sum + d.current_balance, 0);
  const netWorth = totalAssets + totalReceivables - totalDebt;

  const currentMonth = new Date().toISOString().substring(0, 7);
  const txsMonth = queryAll("SELECT type, amount FROM transactions WHERE date LIKE ?;", [`${currentMonth}%`]);
  const monthIncome = txsMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = txsMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const monthSavings = monthIncome - monthExpense;

  const cats = queryAll("SELECT id, name, budget_limit FROM categories WHERE type = 'expense' AND budget_limit > 0;");
  const totalBudget = cats.reduce((sum, c) => sum + c.budget_limit, 0);
  let totalSpentBudget = 0;
  for (const c of cats) {
    const spent = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE category_id = ? AND type = 'expense' AND date LIKE ?;", [c.id, `${currentMonth}%`]).total;
    totalSpentBudget += spent;
  }
  const budgetUsagePct = totalBudget > 0 ? (totalSpentBudget / totalBudget * 100) : 0;

  const recentTxs = queryAll(`
    SELECT t.*, a.name as account_name, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC, t.id DESC LIMIT 6;
  `);

  const upcomingBills = queryAll(`
    SELECT r.*, a.name as account_name, c.name as category_name
    FROM recurring r
    JOIN accounts a ON r.account_id = a.id
    JOIN categories c ON r.category_id = c.id
    WHERE r.active = 1 AND r.type = 'expense'
    ORDER BY r.next_due ASC LIMIT 4;
  `);

  const goals = queryAll("SELECT * FROM goals ORDER BY deadline ASC LIMIT 3;");
  const deadlines = queryAll("SELECT * FROM deadlines WHERE status != 'completed' ORDER BY due_date ASC LIMIT 4;");
  const analytics = getAnalyticsData();

  res.json({
    net_worth: netWorth,
    total_debt: totalDebt,
    month_income: monthIncome,
    month_expense: monthExpense,
    month_savings: monthSavings,
    total_budget: totalBudget,
    total_spent_budget: totalSpentBudget,
    budget_usage_pct: Math.round(budgetUsagePct * 10) / 10,
    recent_transactions: recentTxs,
    upcoming_bills: upcomingBills,
    upcoming_deadlines: deadlines,
    goals: goals,
    category_spending: analytics.category_spending,
    monthly_history: analytics.monthly_history
  });
});

// Helper for analytics
function getAnalyticsData() {
  const currentMonth = new Date().toISOString().substring(0, 7);

  const catSpending = queryAll(`
    SELECT c.name, c.color, c.icon, c.expense_type, COALESCE(SUM(t.amount), 0) as total
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id AND t.type = 'expense' AND t.date LIKE ?
    WHERE c.type = 'expense'
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC;
  `, [`${currentMonth}%`]);

  const topCats = [...catSpending].sort((a,b) => b.total - a.total).slice(0, 5);

  const months = [];
  const dt = new Date();
  for (let i = 5; i >= 0; i--) {
    const temp = new Date(dt.getFullYear(), dt.getMonth() - i, 1);
    const mStr = temp.toISOString().substring(0, 7);
    
    const inc = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date LIKE ?;", [`${mStr}%`]).total;
    const exp = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date LIKE ?;", [`${mStr}%`]).total;
    months.push({
      month: mStr,
      income: inc,
      expense: exp
    });
  }

  return {
    category_spending: catSpending,
    top_categories: topCats,
    monthly_history: months
  };
}

// 2. Analytics
app.get('/api/analytics', (req, res) => {
  res.json(getAnalyticsData());
});

// 3. Needs calculator
app.get('/api/needs-calculator', (req, res) => {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const recIncome = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM recurring WHERE type = 'income' AND active = 1;").total;
  const actualIncome = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date LIKE ?;", [`${currentMonth}%`]).total;
  const expectedIncome = Math.max(recIncome, actualIncome, 1.0);

  const cats = queryAll("SELECT * FROM categories WHERE type = 'expense';");
  const fixedBudget = cats.filter(c => c.expense_type === 'fixed').reduce((sum, c) => sum + c.budget_limit, 0);
  const varBudget = cats.filter(c => c.expense_type === 'variable').reduce((sum, c) => sum + c.budget_limit, 0);
  const discBudget = cats.filter(c => c.expense_type === 'discretionary').reduce((sum, c) => sum + c.budget_limit, 0);

  const debts = queryAll("SELECT * FROM debts WHERE (type IS NULL OR type = 'borrowed');");
  const debtMinimums = debts.reduce((sum, d) => sum + d.minimum_payment, 0);

  let fixedActual = 0;
  let varActual = 0;
  let discActual = 0;

  for (const c of cats) {
    const spent = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE category_id = ? AND type = 'expense' AND date LIKE ?;", [c.id, `${currentMonth}%`]).total;
    if (c.expense_type === 'fixed') fixedActual += spent;
    else if (c.expense_type === 'variable') varActual += spent;
    else discActual += spent;
  }

  const totalFixedNeeds = Math.max(fixedBudget, fixedActual) + debtMinimums;
  const totalVariableWants = Math.max(varBudget + discBudget, varActual + discActual);
  const totalNeeded = totalFixedNeeds + totalVariableWants;
  const survivalCost = fixedBudget + debtMinimums;

  const needsPct = Math.round((totalFixedNeeds / expectedIncome) * 100 * 10) / 10;
  const wantsPct = Math.round((totalVariableWants / expectedIncome) * 100 * 10) / 10;
  const savingsPct = Math.round(Math.max(0, 100 - needsPct - wantsPct) * 10) / 10;

  res.json({
    expected_income: expectedIncome,
    survival_cost: survivalCost,
    fixed_needs: totalFixedNeeds,
    variable_wants: totalVariableWants,
    debt_minimums: debtMinimums,
    total_needed: totalNeeded,
    net_gap: expectedIncome - totalNeeded,
    ratios: {
      needs_pct: needsPct,
      wants_pct: wantsPct,
      savings_pct: savingsPct,
      rec_needs_pct: 50,
      rec_wants_pct: 30,
      rec_savings_pct: 20
    },
    categories: cats
  });
});

// Debt Payment Helpers
function computeNextPaymentDate(dueDay) {
  const now = new Date();
  const day = Math.min(Math.max(parseInt(dueDay, 10) || 1, 1), 28);
  let target = new Date(now.getFullYear(), now.getMonth(), day);
  const todayStr = now.toISOString().split('T')[0];
  if (target.toISOString().split('T')[0] < todayStr) {
    target = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }
  return target.toISOString().split('T')[0];
}

function advanceOneMonth(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1;
  let day = parseInt(parts[2], 10);

  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  const maxDays = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, maxDays);
  const target = new Date(year, month, clampedDay);
  return target.toISOString().split('T')[0];
}

function checkDebtPaymentAlerts() {
  const debts = queryAll("SELECT * FROM debts WHERE current_balance > 0 AND next_payment_date IS NOT NULL AND next_payment_date != '';");
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMs = new Date(todayStr).getTime();

  for (const d of debts) {
    const isLent = d.type === 'lent';
    const dueMs = new Date(d.next_payment_date).getTime();
    const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
    const amountStr = `€${(d.minimum_payment > 0 ? d.minimum_payment : d.current_balance).toFixed(2)}`;

    if (isLent) {
      if (diffDays < 0) {
        const msg = `Expected repayment of ${amountStr} from ${d.name} was due on ${d.next_payment_date}`;
        const existing = queryOne("SELECT id FROM notifications WHERE title = 'Overdue Loan Repayment' AND message = ?", [msg]);
        if (!existing) {
          executeSql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Overdue Loan Repayment', ?)", [msg]);
        }
      } else if (diffDays === 0) {
        const msg = `Expected repayment of ${amountStr} from ${d.name} is due today`;
        const existing = queryOne("SELECT id FROM notifications WHERE title = 'Loan Repayment Due Today' AND message = ?", [msg]);
        if (!existing) {
          executeSql("INSERT INTO notifications (type, title, message) VALUES ('bill', 'Loan Repayment Due Today', ?)", [msg]);
        }
      } else if (diffDays <= 3) {
        const msg = `Expected repayment of ${amountStr} from ${d.name} is due in ${diffDays} day(s) on ${d.next_payment_date}`;
        const existing = queryOne("SELECT id FROM notifications WHERE title = 'Upcoming Loan Repayment' AND message = ?", [msg]);
        if (!existing) {
          executeSql("INSERT INTO notifications (type, title, message) VALUES ('bill', 'Upcoming Loan Repayment', ?)", [msg]);
        }
      }
    } else {
      if (diffDays < 0) {
        const msg = `${d.name} payment of ${amountStr} was due on ${d.next_payment_date}`;
        const existing = queryOne("SELECT id FROM notifications WHERE title = 'Overdue Debt Payment' AND message = ?", [msg]);
        if (!existing) {
          executeSql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Overdue Debt Payment', ?)", [msg]);
        }
      } else if (diffDays === 0) {
        const msg = `${d.name} payment of ${amountStr} is due today`;
        const existing = queryOne("SELECT id FROM notifications WHERE title = 'Debt Payment Due Today' AND message = ?", [msg]);
        if (!existing) {
          executeSql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Debt Payment Due Today', ?)", [msg]);
        }
      } else if (diffDays <= 3) {
        const msg = `${d.name} payment of ${amountStr} is due in ${diffDays} day(s) on ${d.next_payment_date}`;
        const existing = queryOne("SELECT id FROM notifications WHERE title = 'Upcoming Debt Payment' AND message = ?", [msg]);
        if (!existing) {
          executeSql("INSERT INTO notifications (type, title, message) VALUES ('bill', 'Upcoming Debt Payment', ?)", [msg]);
        }
      }
    }
  }
}

// 4. Debts
app.get('/api/debts', (req, res) => {
  const debts = queryAll("SELECT * FROM debts ORDER BY current_balance DESC;");
  for (const d of debts) {
    d.payments = queryAll(`
      SELECT dp.*, a.name as account_name 
      FROM debt_payments dp 
      LEFT JOIN accounts a ON dp.account_id = a.id 
      WHERE dp.debt_id = ? 
      ORDER BY dp.date DESC, dp.id DESC
    `, [d.id]);
  }
  res.json(debts);
});

app.post('/api/debts', (req, res) => {
  const { name, type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color } = req.body;
  const debtType = type === 'lent' ? 'lent' : 'borrowed';
  const currBal = current_balance !== undefined ? parseFloat(current_balance) : parseFloat(total_amount);
  const dueDayVal = parseInt(due_day || 1, 10);
  const rateVal = parseFloat(interest_rate || 0);
  const minVal = parseFloat(minimum_payment || 0);
  const isLoan = rateVal > 0 || minVal > 0 || !!next_payment_date;

  let nextDate = next_payment_date;
  if (isLoan && !nextDate && currBal > 0) {
    nextDate = computeNextPaymentDate(dueDayVal);
  } else if (!isLoan) {
    nextDate = null;
  }

  const debtId = executeSql(
    "INSERT INTO debts (name, type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, debtType, parseFloat(total_amount || 0), currBal, rateVal, minVal, dueDayVal, nextDate || null, color || (debtType === 'lent' ? '#10B981' : '#EF4444')]
  );
  const debt = queryOne("SELECT * FROM debts WHERE id = ?", [debtId]);
  debt.payments = [];
  res.status(201).json(debt);
});

app.put('/api/debts/:id', (req, res) => {
  const debtId = req.params.id;
  const { name, type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color } = req.body;
  const debtType = type === 'lent' ? 'lent' : 'borrowed';
  const currBal = parseFloat(current_balance || 0);
  const dueDayVal = parseInt(due_day || 1, 10);
  const rateVal = parseFloat(interest_rate || 0);
  const minVal = parseFloat(minimum_payment || 0);
  const isLoan = rateVal > 0 || minVal > 0 || !!next_payment_date;

  let nextDate = next_payment_date;
  if (isLoan && !nextDate && currBal > 0) {
    nextDate = computeNextPaymentDate(dueDayVal);
  } else if (!isLoan || currBal <= 0) {
    nextDate = null;
  }

  executeSql(
    "UPDATE debts SET name = ?, type = ?, total_amount = ?, current_balance = ?, interest_rate = ?, minimum_payment = ?, due_day = ?, next_payment_date = ?, color = ? WHERE id = ?",
    [name, debtType, parseFloat(total_amount || 0), currBal, rateVal, minVal, dueDayVal, nextDate || null, color || (debtType === 'lent' ? '#10B981' : '#EF4444'), debtId]
  );
  const debt = queryOne("SELECT * FROM debts WHERE id = ?", [debtId]);
  debt.payments = queryAll(`
    SELECT dp.*, a.name as account_name 
    FROM debt_payments dp 
    LEFT JOIN accounts a ON dp.account_id = a.id 
    WHERE dp.debt_id = ? 
    ORDER BY dp.date DESC, dp.id DESC
  `, [debtId]);
  res.json(debt);
});

function handleDebtPayment(debtId, amount, account_id, date, note, category_id) {
  const paymentAmt = parseFloat(amount || 0);
  const paymentDate = date || new Date().toISOString().split('T')[0];
  const paymentNote = note || '';

  const debtBefore = queryOne("SELECT * FROM debts WHERE id = ?", [debtId]);
  const isLent = debtBefore && debtBefore.type === 'lent';
  const debtName = debtBefore ? debtBefore.name : (isLent ? 'Lent Money' : 'Debt');

  executeSql("UPDATE debts SET current_balance = MAX(0, current_balance - ?) WHERE id = ?", [paymentAmt, debtId]);

  executeSql(
    "INSERT INTO debt_payments (debt_id, amount, date, account_id, note) VALUES (?, ?, ?, ?, ?)",
    [debtId, paymentAmt, paymentDate, account_id ? parseInt(account_id) : null, paymentNote]
  );

  if (account_id) {
    let catId = category_id ? parseInt(category_id) : null;
    if (isLent) {
      // Money received from borrower -> Income transaction, credit account
      if (!catId) {
        const incomeCat = queryOne("SELECT id FROM categories WHERE type = 'income' AND (LOWER(name) LIKE '%loan%' OR LOWER(name) LIKE '%repayment%' OR LOWER(name) LIKE '%other%');");
        if (incomeCat) {
          catId = incomeCat.id;
        } else {
          const incCats = queryAll("SELECT id FROM categories WHERE type = 'income';");
          catId = incCats.length > 0 ? incCats[0].id : 1;
        }
      }

      executeSql("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (?, ?, ?, 'income', ?, ?)",
        [account_id, catId, paymentAmt, paymentDate, `Repayment Received: ${debtName}${paymentNote ? ' - ' + paymentNote : ''}`]
      );
      executeSql("UPDATE accounts SET balance = balance + ? WHERE id = ?", [paymentAmt, account_id]);
    } else {
      // Money paid towards debt -> Expense transaction, deduct from account
      if (!catId) {
        const debtCat = queryOne("SELECT id FROM categories WHERE type = 'expense' AND (LOWER(name) LIKE '%debt%' OR LOWER(name) LIKE '%loan%');");
        if (debtCat) {
          catId = debtCat.id;
        } else {
          const cats = queryAll("SELECT id FROM categories WHERE type = 'expense';");
          catId = cats.length > 0 ? cats[0].id : 1;
        }
      }

      executeSql("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (?, ?, ?, 'expense', ?, ?)",
        [account_id, catId, paymentAmt, paymentDate, `Debt Payment: ${debtName}${paymentNote ? ' - ' + paymentNote : ''}`]
      );
      executeSql("UPDATE accounts SET balance = balance - ? WHERE id = ?", [paymentAmt, account_id]);
      
      // Ripple Effect: Check if payment triggers budget warning/exceeded notification
      checkBudgetAlert(catId);
    }
  }

  // Auto-advance next_payment_date if debt is still active and has scheduled payments
  const debt = queryOne("SELECT * FROM debts WHERE id = ?", [debtId]);
  if (debt) {
    const hasSchedule = debt.interest_rate > 0 || debt.minimum_payment > 0 || debt.due_day > 1;
    if (debt.current_balance <= 0 || !hasSchedule) {
      executeSql("UPDATE debts SET next_payment_date = NULL WHERE id = ?", [debtId]);
    } else if (debt.next_payment_date) {
      const advancedDate = advanceOneMonth(debt.next_payment_date);
      executeSql("UPDATE debts SET next_payment_date = ? WHERE id = ?", [advancedDate, debtId]);
    }
  }

  const updatedDebt = queryOne("SELECT * FROM debts WHERE id = ?", [debtId]);
  if (updatedDebt) {
    updatedDebt.payments = queryAll(`
      SELECT dp.*, a.name as account_name 
      FROM debt_payments dp 
      LEFT JOIN accounts a ON dp.account_id = a.id 
      WHERE dp.debt_id = ? 
      ORDER BY dp.date DESC, dp.id DESC
    `, [debtId]);
  }
  return updatedDebt;
}

app.put('/api/debts/:id/payment', (req, res) => {
  const debtId = req.params.id;
  const { amount, account_id, date, note, category_id } = req.body;
  const updatedDebt = handleDebtPayment(debtId, amount, account_id, date, note, category_id);
  res.json(updatedDebt);
});

app.post('/api/debts/:id/payment', (req, res) => {
  const debtId = req.params.id;
  const { amount, account_id, date, note, category_id } = req.body;
  const updatedDebt = handleDebtPayment(debtId, amount, account_id, date, note, category_id);
  res.json(updatedDebt);
});

app.delete('/api/debts/:id', (req, res) => {
  executeSql("DELETE FROM debts WHERE id = ?", [req.params.id]);
  res.json({ message: "Debt deleted" });
});

// 5. Deadlines
app.get('/api/deadlines', (req, res) => {
  const items = queryAll("SELECT * FROM deadlines ORDER BY due_date ASC;");
  const today = new Date().toISOString().split('T')[0];
  for (const item of items) {
    if (item.due_date < today && item.status === 'pending') {
      executeSql("UPDATE deadlines SET status = 'overdue' WHERE id = ?", [item.id]);
      item.status = 'overdue';
    }
  }
  res.json(items);
});

app.post('/api/deadlines', (req, res) => {
  const { title, description, due_date, category, amount, priority } = req.body;
  const deadlineId = executeSql(
    "INSERT INTO deadlines (title, description, due_date, category, amount, priority) VALUES (?, ?, ?, ?, ?, ?)",
    [title, description || '', due_date, category || 'custom', parseFloat(amount || 0), priority || 'medium']
  );
  res.status(201).json(queryOne("SELECT * FROM deadlines WHERE id = ?", [deadlineId]));
});

app.put('/api/deadlines/:id', (req, res) => {
  const deadlineId = req.params.id;
  const { title, description, due_date, category, amount, priority, status } = req.body;
  executeSql(
    "UPDATE deadlines SET title = ?, description = ?, due_date = ?, category = ?, amount = ?, priority = ?, status = ? WHERE id = ?",
    [title, description || '', due_date, category || 'custom', parseFloat(amount || 0), priority || 'medium', status || 'pending', deadlineId]
  );
  res.json(queryOne("SELECT * FROM deadlines WHERE id = ?", [deadlineId]));
});

app.put('/api/deadlines/:id/complete', (req, res) => {
  const deadlineId = req.params.id;
  executeSql("UPDATE deadlines SET status = 'completed' WHERE id = ?", [deadlineId]);
  res.json(queryOne("SELECT * FROM deadlines WHERE id = ?", [deadlineId]));
});

app.delete('/api/deadlines/:id', (req, res) => {
  executeSql("DELETE FROM deadlines WHERE id = ?", [req.params.id]);
  res.json({ message: "Deadline deleted" });
});

// 6. Accounts
app.get('/api/accounts', (req, res) => {
  res.json(queryAll("SELECT * FROM accounts ORDER BY id ASC;"));
});

app.post('/api/accounts', (req, res) => {
  const { name, type, balance, color } = req.body;
  const acctId = executeSql(
    "INSERT INTO accounts (name, type, balance, color) VALUES (?, ?, ?, ?)",
    [name, type || 'checking', parseFloat(balance || 0), color || '#6E54FF']
  );
  res.status(201).json(queryOne("SELECT * FROM accounts WHERE id = ?", [acctId]));
});

app.put('/api/accounts/:id', (req, res) => {
  const acctId = req.params.id;
  const { name, type, balance, color } = req.body;
  executeSql(
    "UPDATE accounts SET name = ?, type = ?, balance = ?, color = ? WHERE id = ?",
    [name, type, parseFloat(balance || 0), color, acctId]
  );
  res.json(queryOne("SELECT * FROM accounts WHERE id = ?", [acctId]));
});

app.delete('/api/accounts/:id', (req, res) => {
  executeSql("DELETE FROM accounts WHERE id = ?", [req.params.id]);
  res.json({ message: "Account deleted" });
});

// 7. Categories
app.get('/api/categories', (req, res) => {
  res.json(queryAll("SELECT * FROM categories ORDER BY name ASC;"));
});

app.post('/api/categories', (req, res) => {
  const { name, type, expense_type, icon, color, budget_limit, rollover } = req.body;
  const catId = executeSql(
    "INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, type || 'expense', expense_type || 'variable', icon || 'tag', color || '#6E54FF', parseFloat(budget_limit || 0), rollover ? 1 : 0]
  );
  res.status(201).json(queryOne("SELECT * FROM categories WHERE id = ?", [catId]));
});

app.put('/api/categories/:id', (req, res) => {
  const catId = req.params.id;
  const { name, type, expense_type, icon, color, budget_limit, rollover } = req.body;
  executeSql(
    "UPDATE categories SET name = ?, type = ?, expense_type = ?, icon = ?, color = ?, budget_limit = ?, rollover = ? WHERE id = ?",
    [name, type, expense_type || 'variable', icon, color, parseFloat(budget_limit || 0), rollover ? 1 : 0, catId]
  );
  res.json(queryOne("SELECT * FROM categories WHERE id = ?", [catId]));
});

app.delete('/api/categories/:id', (req, res) => {
  executeSql("DELETE FROM categories WHERE id = ?", [req.params.id]);
  res.json({ message: "Category deleted" });
});

// 8. Transactions & Export
app.get('/api/transactions/export', (req, res) => {
  const txs = queryAll(`
    SELECT t.id, t.date, a.name as account_name, c.name as category_name, t.type, t.amount, t.note 
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC;
  `);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');

  let csvContent = 'ID,Date,Account,Category,Type,Amount,Note\n';
  for (const t of txs) {
    csvContent += `"${t.id}","${t.date}","${t.account_name}","${t.category_name}","${t.type}","${t.amount}","${t.note || ''}"\n`;
  }
  res.send(csvContent);
});

app.get('/api/transactions', (req, res) => {
  let query = `
    SELECT t.*, a.name as account_name, a.color as account_color, c.name as category_name, c.icon as category_icon, c.color as category_color, c.expense_type
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `;
  const args = [];
  if (req.query.account_id) {
    query += " AND t.account_id = ?";
    args.push(req.query.account_id);
  }
  if (req.query.category_id) {
    query += " AND t.category_id = ?";
    args.push(req.query.category_id);
  }
  if (req.query.type) {
    query += " AND t.type = ?";
    args.push(req.query.type);
  }
  if (req.query.start_date) {
    query += " AND t.date >= ?";
    args.push(req.query.start_date);
  }
  if (req.query.end_date) {
    query += " AND t.date <= ?";
    args.push(req.query.end_date);
  }

  query += " ORDER BY t.date DESC, t.id DESC;";
  const txs = queryAll(query, args);
  res.json(txs);
});

app.post('/api/transactions/import', (req, res) => {
  const list = Array.isArray(req.body) ? req.body : (req.body.transactions || []);
  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: "No transactions provided for import" });
  }

  const allAccounts = queryAll("SELECT * FROM accounts;");
  const allCategories = queryAll("SELECT * FROM categories;");

  if (allAccounts.length === 0 || allCategories.length === 0) {
    return res.status(400).json({ error: "Cannot import transactions without existing accounts and categories" });
  }

  const inserted = [];
  const checkedCategories = new Set();

  const insertTransaction = db.transaction((items) => {
    for (const item of items) {
      let accId = null;
      if (item.account_id) {
        const found = allAccounts.find(a => a.id === parseInt(item.account_id));
        if (found) accId = found.id;
      }
      if (!accId && (item.account_name || item.account)) {
        const nameQuery = String(item.account_name || item.account).trim().toLowerCase();
        const found = allAccounts.find(a => a.name.toLowerCase() === nameQuery);
        if (found) accId = found.id;
      }
      if (!accId) {
        accId = allAccounts[0].id;
      }

      let txType = (item.type || 'expense').toLowerCase();
      if (!['income', 'expense', 'transfer'].includes(txType)) {
        txType = 'expense';
      }

      let catId = null;
      if (item.category_id) {
        const found = allCategories.find(c => c.id === parseInt(item.category_id));
        if (found) catId = found.id;
      }
      if (!catId && (item.category_name || item.category)) {
        const catQuery = String(item.category_name || item.category).trim().toLowerCase();
        const found = allCategories.find(c => c.name.toLowerCase() === catQuery);
        if (found) catId = found.id;
      }
      if (!catId) {
        const matchingTypeCat = allCategories.find(c => c.type === txType);
        catId = matchingTypeCat ? matchingTypeCat.id : allCategories[0].id;
      }

      const txAmt = Math.abs(parseFloat(item.amount || 0));
      if (isNaN(txAmt) || txAmt <= 0) continue;

      let txDate = item.date || new Date().toISOString().split('T')[0];
      if (/^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}$/.test(txDate)) {
        const parts = txDate.split(/[\/\.\-]/);
        txDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      const txNote = item.note || item.memo || item.description || '';
      const targetAccId = item.target_account_id ? parseInt(item.target_account_id) : null;

      const txId = executeSql(
        "INSERT INTO transactions (account_id, category_id, amount, type, date, note, target_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [accId, catId, txAmt, txType, txDate, txNote, targetAccId]
      );

      // Update account balance
      if (txType === 'income') {
        executeSql("UPDATE accounts SET balance = balance + ? WHERE id = ?", [txAmt, accId]);
      } else if (txType === 'expense') {
        executeSql("UPDATE accounts SET balance = balance - ? WHERE id = ?", [txAmt, accId]);
      } else if (txType === 'transfer' && targetAccId) {
        executeSql("UPDATE accounts SET balance = balance - ? WHERE id = ?", [txAmt, accId]);
        executeSql("UPDATE accounts SET balance = balance + ? WHERE id = ?", [txAmt, targetAccId]);
      }

      if (txType === 'expense') {
        checkedCategories.add(catId);
      }

      inserted.push(txId);
    }
  });

  try {
    insertTransaction(list);
    for (const catId of checkedCategories) {
      checkBudgetAlert(catId);
    }
    return res.status(201).json({
      success: true,
      message: `Successfully imported ${inserted.length} transactions`,
      count: inserted.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', (req, res) => {
  const { account_id, category_id, amount, type, date, note, target_account_id } = req.body;
  const accId = parseInt(account_id);
  const catId = parseInt(category_id);
  const txAmt = parseFloat(amount);
  const txType = type || 'expense';
  const txDate = date || new Date().toISOString().split('T')[0];
  const txNote = note || '';

  const txId = executeSql(
    "INSERT INTO transactions (account_id, category_id, amount, type, date, note, target_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [accId, catId, txAmt, txType, txDate, txNote, target_account_id ? parseInt(target_account_id) : null]
  );

  // Update account balance
  if (txType === 'income') {
    executeSql("UPDATE accounts SET balance = balance + ? WHERE id = ?", [txAmt, accId]);
  } else if (txType === 'expense') {
    executeSql("UPDATE accounts SET balance = balance - ? WHERE id = ?", [txAmt, accId]);
  } else if (txType === 'transfer' && target_account_id) {
    executeSql("UPDATE accounts SET balance = balance - ? WHERE id = ?", [txAmt, accId]);
    executeSql("UPDATE accounts SET balance = balance + ? WHERE id = ?", [txAmt, parseInt(target_account_id)]);
  }

  if (txType === 'expense') {
    checkBudgetAlert(catId);
  }

  res.status(201).json(queryOne("SELECT * FROM transactions WHERE id = ?", [txId]));
});

app.delete('/api/transactions/:id', (req, res) => {
  const txId = req.params.id;
  const tx = queryOne("SELECT * FROM transactions WHERE id = ?", [txId]);
  if (tx) {
    if (tx.type === 'income') {
      executeSql("UPDATE accounts SET balance = balance - ? WHERE id = ?", [tx.amount, tx.account_id]);
    } else if (tx.type === 'expense') {
      executeSql("UPDATE accounts SET balance = balance + ? WHERE id = ?", [tx.amount, tx.account_id]);
    } else if (tx.type === 'transfer' && tx.target_account_id) {
      executeSql("UPDATE accounts SET balance = balance + ? WHERE id = ?", [tx.amount, tx.account_id]);
      executeSql("UPDATE accounts SET balance = balance - ? WHERE id = ?", [tx.amount, tx.target_account_id]);
    }
    executeSql("DELETE FROM transactions WHERE id = ?", [txId]);
  }
  res.json({ message: "Transaction deleted" });
});

// 9. Recurring Bills
app.get('/api/recurring', (req, res) => {
  const items = queryAll(`
    SELECT r.*, a.name as account_name, c.name as category_name, c.icon as category_icon
    FROM recurring r
    JOIN accounts a ON r.account_id = a.id
    JOIN categories c ON r.category_id = c.id
    ORDER BY r.next_due ASC;
  `);
  res.json(items);
});

app.post('/api/recurring', (req, res) => {
  const { name, account_id, category_id, amount, type, frequency, next_due } = req.body;
  const recId = executeSql(
    "INSERT INTO recurring (name, account_id, category_id, amount, type, frequency, next_due) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, parseInt(account_id), parseInt(category_id), parseFloat(amount), type || 'expense', frequency || 'monthly', next_due]
  );
  res.status(201).json(queryOne("SELECT * FROM recurring WHERE id = ?", [recId]));
});

app.put('/api/recurring/:id', (req, res) => {
  const recId = req.params.id;
  const current = queryOne("SELECT * FROM recurring WHERE id = ?", [recId]);
  if (!current) return res.status(404).json({ error: "Item not found" });

  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : current.active;
  const next_due = req.body.next_due || current.next_due;
  const amount = req.body.amount !== undefined ? parseFloat(req.body.amount) : current.amount;
  const name = req.body.name || current.name;
  const account_id = req.body.account_id ? parseInt(req.body.account_id) : current.account_id;
  const category_id = req.body.category_id ? parseInt(req.body.category_id) : current.category_id;
  const frequency = req.body.frequency || current.frequency;
  const type = req.body.type || current.type;

  executeSql(`
    UPDATE recurring 
    SET active = ?, next_due = ?, amount = ?, name = ?, account_id = ?, category_id = ?, frequency = ?, type = ?
    WHERE id = ?
  `, [active, next_due, amount, name, account_id, category_id, frequency, type, recId]);

  res.json(queryOne("SELECT * FROM recurring WHERE id = ?", [recId]));
});

app.delete('/api/recurring/:id', (req, res) => {
  executeSql("DELETE FROM recurring WHERE id = ?", [req.params.id]);
  res.json({ message: "Recurring item deleted" });
});

// 10. Goals
app.get('/api/goals', (req, res) => {
  res.json(queryAll("SELECT * FROM goals ORDER BY deadline ASC;"));
});

app.post('/api/goals', (req, res) => {
  const { name, target_amount, current_amount, deadline, color } = req.body;
  const goalId = executeSql(
    "INSERT INTO goals (name, target_amount, current_amount, deadline, color) VALUES (?, ?, ?, ?, ?)",
    [name, parseFloat(target_amount), parseFloat(current_amount || 0.0), deadline, color || '#10B981']
  );
  res.status(201).json(queryOne("SELECT * FROM goals WHERE id = ?", [goalId]));
});

app.put('/api/goals/:id', (req, res) => {
  const goalId = req.params.id;
  if (req.body.contribution !== undefined) {
    const contrib = parseFloat(req.body.contribution);
    executeSql("UPDATE goals SET current_amount = current_amount + ? WHERE id = ?", [contrib, goalId]);
    const goal = queryOne("SELECT * FROM goals WHERE id = ?", [goalId]);
    if (goal && goal.current_amount >= goal.target_amount) {
      executeSql("INSERT INTO notifications (type, title, message) VALUES ('milestone', 'Goal Completed!', ?)",
        [`Congratulations! You reached your goal for ${goal.name} ($${goal.target_amount.toFixed(2)})`]
      );
    }
    res.json(goal);
  } else {
    const { name, target_amount, current_amount, deadline, color } = req.body;
    executeSql("UPDATE goals SET name = ?, target_amount = ?, current_amount = ?, deadline = ?, color = ? WHERE id = ?",
      [name, parseFloat(target_amount), parseFloat(current_amount), deadline, color, goalId]
    );
    res.json(queryOne("SELECT * FROM goals WHERE id = ?", [goalId]));
  }
});

app.delete('/api/goals/:id', (req, res) => {
  executeSql("DELETE FROM goals WHERE id = ?", [req.params.id]);
  res.json({ message: "Goal deleted" });
});

// 11. Notifications
app.get('/api/notifications', (req, res) => {
  checkDebtPaymentAlerts();
  res.json(queryAll("SELECT * FROM notifications ORDER BY id DESC LIMIT 50;"));
});

app.put('/api/notifications/:id/read', (req, res) => {
  executeSql("UPDATE notifications SET read = 1 WHERE id = ?", [req.params.id]);
  res.json({ message: "Marked read" });
});

app.post('/api/notifications/read-all', (req, res) => {
  executeSql("UPDATE notifications SET read = 1;");
  res.json({ message: "All marked read" });
});

// Fallback routing for single page app
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FinSet Express App Server running on http://localhost:${PORT}`);
});

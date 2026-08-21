import json
import csv
import io
import re
from datetime import datetime, timedelta
from server.db import query_all, query_one, execute_sql, get_db

def handle_api_request(method, path, body, query_params):
    parts = [p for p in path.split('/') if p]
    resource = parts[1] if len(parts) > 1 else ''
    resource_id = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else None
    action = parts[3] if len(parts) > 3 else (parts[2] if len(parts) > 2 and not parts[2].isdigit() else None)

    if resource == 'dashboard':
        return get_dashboard_summary()

    if resource == 'analytics':
        return get_analytics_data()

    if resource == 'needs-calculator':
        return get_needs_calculator_data()

    if resource == 'debts':
        if method == 'GET':
            debts = query_all("SELECT * FROM debts ORDER BY current_balance DESC;")
            for d in debts:
                d['payments'] = query_all("""
                    SELECT dp.*, a.name as account_name 
                    FROM debt_payments dp 
                    LEFT JOIN accounts a ON dp.account_id = a.id 
                    WHERE dp.debt_id = ? 
                    ORDER BY dp.date DESC, dp.id DESC
                """, (d['id'],))
            return {"status": 200, "data": debts}
        elif method == 'POST':
            name = body.get('name')
            debt_type = 'lent' if body.get('type') == 'lent' else 'borrowed'
            total_amount = float(body.get('total_amount', 0))
            current_balance = float(body.get('current_balance', total_amount))
            interest_rate = float(body.get('interest_rate', 0))
            minimum_payment = float(body.get('minimum_payment', 0))
            due_day = int(body.get('due_day', 1))
            next_payment_date = body.get('next_payment_date')
            color = body.get('color', '#10B981' if debt_type == 'lent' else '#EF4444')

            is_loan = interest_rate > 0 or minimum_payment > 0 or bool(next_payment_date)
            if is_loan and not next_payment_date and current_balance > 0:
                next_payment_date = compute_next_payment_date(due_day)
            elif not is_loan:
                next_payment_date = None

            debt_id = execute_sql(
                "INSERT INTO debts (name, type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (name, debt_type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date if next_payment_date else None, color)
            )
            debt = query_one("SELECT * FROM debts WHERE id = ?", (debt_id,))
            debt['payments'] = []
            return {"status": 201, "data": debt}
        elif (method == 'PUT' or method == 'POST') and resource_id:
            if action == 'payment':
                amount = float(body.get('amount', 0))
                account_id = body.get('account_id')
                category_id = body.get('category_id')
                date_str = body.get('date', datetime.now().strftime('%Y-%m-%d'))
                note_str = body.get('note', '')

                debt_before = query_one("SELECT * FROM debts WHERE id = ?", (resource_id,))
                is_lent = debt_before and debt_before.get('type') == 'lent'
                debt_name = debt_before['name'] if debt_before else ('Lent Money' if is_lent else 'Debt')

                execute_sql("UPDATE debts SET current_balance = MAX(0, current_balance - ?) WHERE id = ?", (amount, resource_id))

                execute_sql("INSERT INTO debt_payments (debt_id, amount, date, account_id, note) VALUES (?, ?, ?, ?, ?)",
                            (resource_id, amount, date_str, int(account_id) if account_id else None, note_str))

                if account_id:
                    cat_id = int(category_id) if category_id else None
                    if is_lent:
                        # Repayment received -> Income transaction, credit account
                        if not cat_id:
                            inc_cat = query_one("SELECT id FROM categories WHERE type = 'income' AND (LOWER(name) LIKE '%loan%' OR LOWER(name) LIKE '%repayment%' OR LOWER(name) LIKE '%other%');")
                            if inc_cat:
                                cat_id = inc_cat['id']
                            else:
                                inc_cats = query_all("SELECT id FROM categories WHERE type = 'income';")
                                cat_id = inc_cats[0]['id'] if inc_cats else 1

                        tx_note = f"Repayment Received: {debt_name}" + (f" - {note_str}" if note_str else "")
                        execute_sql("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (?, ?, ?, 'income', ?, ?)",
                                    (account_id, cat_id, amount, date_str, tx_note))
                        execute_sql("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, account_id))
                    else:
                        # Debt payment -> Expense transaction, deduct from account
                        if not cat_id:
                            debt_cat = query_one("SELECT id FROM categories WHERE type = 'expense' AND (LOWER(name) LIKE '%debt%' OR LOWER(name) LIKE '%loan%');")
                            if debt_cat:
                                cat_id = debt_cat['id']
                            else:
                                cats = query_all("SELECT id FROM categories WHERE type = 'expense';")
                                cat_id = cats[0]['id'] if cats else 1

                        tx_note = f"Debt Payment: {debt_name}" + (f" - {note_str}" if note_str else "")
                        execute_sql("INSERT INTO transactions (account_id, category_id, amount, type, date, note) VALUES (?, ?, ?, 'expense', ?, ?)",
                                    (account_id, cat_id, amount, date_str, tx_note))
                        execute_sql("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, account_id))
                        check_budget_alert(cat_id)

                # Auto-advance next_payment_date if active
                debt = query_one("SELECT * FROM debts WHERE id = ?", (resource_id,))
                if debt:
                    has_sched = debt['interest_rate'] > 0 or debt['minimum_payment'] > 0 or (debt.get('due_day') and int(debt['due_day']) > 1)
                    if debt['current_balance'] <= 0 or not has_sched:
                        execute_sql("UPDATE debts SET next_payment_date = NULL WHERE id = ?", (resource_id,))
                    elif debt['next_payment_date']:
                        adv_date = advance_one_month(debt['next_payment_date'])
                        execute_sql("UPDATE debts SET next_payment_date = ? WHERE id = ?", (adv_date, resource_id))

                updated_debt = query_one("SELECT * FROM debts WHERE id = ?", (resource_id,))
                if updated_debt:
                    updated_debt['payments'] = query_all("""
                        SELECT dp.*, a.name as account_name 
                        FROM debt_payments dp 
                        LEFT JOIN accounts a ON dp.account_id = a.id 
                        WHERE dp.debt_id = ? 
                        ORDER BY dp.date DESC, dp.id DESC
                    """, (resource_id,))
                return {"status": 200, "data": updated_debt}
            else:
                name = body.get('name')
                debt_type = 'lent' if body.get('type') == 'lent' else 'borrowed'
                total_amount = float(body.get('total_amount', 0))
                current_balance = float(body.get('current_balance', 0))
                interest_rate = float(body.get('interest_rate', 0))
                minimum_payment = float(body.get('minimum_payment', 0))
                due_day = int(body.get('due_day', 1))
                next_payment_date = body.get('next_payment_date')
                color = body.get('color', '#10B981' if debt_type == 'lent' else '#EF4444')

                is_loan = interest_rate > 0 or minimum_payment > 0 or bool(next_payment_date)
                if is_loan and not next_payment_date and current_balance > 0:
                    next_payment_date = compute_next_payment_date(due_day)
                elif not is_loan or current_balance <= 0:
                    next_payment_date = None

                execute_sql("UPDATE debts SET name = ?, type = ?, total_amount = ?, current_balance = ?, interest_rate = ?, minimum_payment = ?, due_day = ?, next_payment_date = ?, color = ? WHERE id = ?",
                            (name, debt_type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date if next_payment_date else None, color, resource_id))
                updated_debt = query_one("SELECT * FROM debts WHERE id = ?", (resource_id,))
                if updated_debt:
                    updated_debt['payments'] = query_all("""
                        SELECT dp.*, a.name as account_name 
                        FROM debt_payments dp 
                        LEFT JOIN accounts a ON dp.account_id = a.id 
                        WHERE dp.debt_id = ? 
                        ORDER BY dp.date DESC, dp.id DESC
                    """, (resource_id,))
                return {"status": 200, "data": updated_debt}
        elif method == 'DELETE' and resource_id:
            execute_sql("DELETE FROM debts WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Debt deleted"}}

    if resource == 'deadlines':
        if method == 'GET':
            items = query_all("SELECT * FROM deadlines ORDER BY due_date ASC;")
            # Auto-update status to overdue if due_date < today
            today = datetime.now().strftime('%Y-%m-%d')
            for item in items:
                if item['due_date'] < today and item['status'] == 'pending':
                    execute_sql("UPDATE deadlines SET status = 'overdue' WHERE id = ?", (item['id'],))
                    item['status'] = 'overdue'
            return {"status": 200, "data": items}
        elif method == 'POST':
            title = body.get('title')
            description = body.get('description', '')
            due_date = body.get('due_date')
            category = body.get('category', 'custom')
            amount = float(body.get('amount', 0))
            priority = body.get('priority', 'medium')
            deadline_id = execute_sql(
                "INSERT INTO deadlines (title, description, due_date, category, amount, priority) VALUES (?, ?, ?, ?, ?, ?)",
                (title, description, due_date, category, amount, priority)
            )
            return {"status": 201, "data": query_one("SELECT * FROM deadlines WHERE id = ?", (deadline_id,))}
        elif method == 'PUT' and resource_id:
            if action == 'complete':
                execute_sql("UPDATE deadlines SET status = 'completed' WHERE id = ?", (resource_id,))
                return {"status": 200, "data": query_one("SELECT * FROM deadlines WHERE id = ?", (resource_id,))}
            else:
                title = body.get('title')
                description = body.get('description', '')
                due_date = body.get('due_date')
                category = body.get('category', 'custom')
                amount = float(body.get('amount', 0))
                priority = body.get('priority', 'medium')
                status = body.get('status', 'pending')
                execute_sql("UPDATE deadlines SET title = ?, description = ?, due_date = ?, category = ?, amount = ?, priority = ?, status = ? WHERE id = ?",
                            (title, description, due_date, category, amount, priority, status, resource_id))
                return {"status": 200, "data": query_one("SELECT * FROM deadlines WHERE id = ?", (resource_id,))}
        elif method == 'DELETE' and resource_id:
            execute_sql("DELETE FROM deadlines WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Deadline deleted"}}

    if resource == 'accounts':
        if method == 'GET':
            accounts = query_all("SELECT * FROM accounts ORDER BY id ASC;")
            return {"status": 200, "data": accounts}
        elif method == 'POST':
            name = body.get('name')
            acct_type = body.get('type', 'checking')
            balance = float(body.get('balance', 0.0))
            color = body.get('color', '#7C3AED')
            acct_id = execute_sql(
                "INSERT INTO accounts (name, type, balance, color) VALUES (?, ?, ?, ?)",
                (name, acct_type, balance, color)
            )
            return {"status": 201, "data": query_one("SELECT * FROM accounts WHERE id = ?", (acct_id,))}
        elif method == 'PUT' and resource_id:
            name = body.get('name')
            acct_type = body.get('type')
            balance = float(body.get('balance', 0))
            color = body.get('color')
            execute_sql(
                "UPDATE accounts SET name = ?, type = ?, balance = ?, color = ? WHERE id = ?",
                (name, acct_type, balance, color, resource_id)
            )
            return {"status": 200, "data": query_one("SELECT * FROM accounts WHERE id = ?", (resource_id,))}
        elif method == 'DELETE' and resource_id:
            execute_sql("DELETE FROM accounts WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Account deleted"}}

    if resource == 'categories':
        if method == 'GET':
            categories = query_all("SELECT * FROM categories ORDER BY name ASC;")
            return {"status": 200, "data": categories}
        elif method == 'POST':
            name = body.get('name')
            cat_type = body.get('type', 'expense')
            expense_type = body.get('expense_type', 'variable')
            icon = body.get('icon', 'tag')
            color = body.get('color', '#4F46E5')
            budget_limit = float(body.get('budget_limit', 0.0))
            rollover = 1 if body.get('rollover') else 0
            cat_id = execute_sql(
                "INSERT INTO categories (name, type, expense_type, icon, color, budget_limit, rollover) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (name, cat_type, expense_type, icon, color, budget_limit, rollover)
            )
            return {"status": 201, "data": query_one("SELECT * FROM categories WHERE id = ?", (cat_id,))}
        elif method == 'PUT' and resource_id:
            name = body.get('name')
            cat_type = body.get('type')
            expense_type = body.get('expense_type', 'variable')
            icon = body.get('icon')
            color = body.get('color')
            budget_limit = float(body.get('budget_limit', 0))
            rollover = 1 if body.get('rollover') else 0
            execute_sql(
                "UPDATE categories SET name = ?, type = ?, expense_type = ?, icon = ?, color = ?, budget_limit = ?, rollover = ? WHERE id = ?",
                (name, cat_type, expense_type, icon, color, budget_limit, rollover, resource_id)
            )
            return {"status": 200, "data": query_one("SELECT * FROM categories WHERE id = ?", (resource_id,))}
        elif method == 'DELETE' and resource_id:
            execute_sql("DELETE FROM categories WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Category deleted"}}

    if resource == 'transactions':
        if action == 'export' and method == 'GET':
            txs = query_all("""
                SELECT t.id, t.date, a.name as account_name, c.name as category_name, t.type, t.amount, t.note 
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                JOIN categories c ON t.category_id = c.id
                ORDER BY t.date DESC;
            """)
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['ID', 'Date', 'Account', 'Category', 'Type', 'Amount', 'Note'])
            for r in txs:
                writer.writerow([r['id'], r['date'], r['account_name'], r['category_name'], r['type'], r['amount'], r['note']])
            return {"status": 200, "content_type": "text/csv", "raw": output.getvalue()}

        if method == 'GET':
            query = """
                SELECT t.*, a.name as account_name, a.color as account_color, c.name as category_name, c.icon as category_icon, c.color as category_color, c.expense_type
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                JOIN categories c ON t.category_id = c.id
                WHERE 1=1
            """
            args = []
            if query_params.get('account_id'):
                query += " AND t.account_id = ?"
                args.append(query_params['account_id'])
            if query_params.get('category_id'):
                query += " AND t.category_id = ?"
                args.append(query_params['category_id'])
            if query_params.get('type'):
                query += " AND t.type = ?"
                args.append(query_params['type'])
            if query_params.get('start_date'):
                query += " AND t.date >= ?"
                args.append(query_params['start_date'])
            if query_params.get('end_date'):
                query += " AND t.date <= ?"
                args.append(query_params['end_date'])

            query += " ORDER BY t.date DESC, t.id DESC;"
            txs = query_all(query, args)
            return {"status": 200, "data": txs}

        elif method == 'POST' and action == 'import':
            items = body if isinstance(body, list) else body.get('transactions', [])
            if not items:
                return {"status": 400, "data": {"error": "No transactions provided for import"}}

            all_accounts = query_all("SELECT * FROM accounts;")
            all_categories = query_all("SELECT * FROM categories;")
            if not all_accounts or not all_categories:
                return {"status": 400, "data": {"error": "Cannot import transactions without existing accounts and categories"}}

            inserted_count = 0
            checked_categories = set()

            for item in items:
                acc_id = None
                if item.get('account_id'):
                    found = next((a for a in all_accounts if a['id'] == int(item['account_id'])), None)
                    if found:
                        acc_id = found['id']
                if not acc_id and (item.get('account_name') or item.get('account')):
                    name_q = str(item.get('account_name') or item.get('account')).strip().lower()
                    found = next((a for a in all_accounts if a['name'].lower() == name_q), None)
                    if found:
                        acc_id = found['id']
                if not acc_id:
                    acc_id = all_accounts[0]['id']

                tx_type = str(item.get('type', 'expense')).lower()
                if tx_type not in ('income', 'expense', 'transfer'):
                    tx_type = 'expense'

                cat_id = None
                if item.get('category_id'):
                    found = next((c for c in all_categories if c['id'] == int(item['category_id'])), None)
                    if found:
                        cat_id = found['id']
                if not cat_id and (item.get('category_name') or item.get('category')):
                    cat_q = str(item.get('category_name') or item.get('category')).strip().lower()
                    found = next((c for c in all_categories if c['name'].lower() == cat_q), None)
                    if found:
                        cat_id = found['id']
                if not cat_id:
                    match_cat = next((c for c in all_categories if c['type'] == tx_type), None)
                    cat_id = match_cat['id'] if match_cat else all_categories[0]['id']

                try:
                    amount = abs(float(item.get('amount', 0)))
                except (ValueError, TypeError):
                    continue

                if amount <= 0:
                    continue

                date_val = str(item.get('date') or datetime.now().strftime('%Y-%m-%d')).strip()
                dmy = re.match(r'^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$', date_val)
                if dmy:
                    date_val = f"{dmy.group(3)}-{dmy.group(2).zfill(2)}-{dmy.group(1).zfill(2)}"

                note_val = item.get('note') or item.get('memo') or item.get('description') or ''
                target_acc_id = int(item['target_account_id']) if item.get('target_account_id') else None

                execute_sql(
                    "INSERT INTO transactions (account_id, category_id, amount, type, date, note, target_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (acc_id, cat_id, amount, tx_type, date_val, note_val, target_acc_id)
                )

                if tx_type == 'income':
                    execute_sql("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, acc_id))
                elif tx_type == 'expense':
                    execute_sql("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, acc_id))
                elif tx_type == 'transfer' and target_acc_id:
                    execute_sql("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, acc_id))
                    execute_sql("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, target_acc_id))

                if tx_type == 'expense':
                    checked_categories.add(cat_id)

                inserted_count += 1

            for cid in checked_categories:
                check_budget_alert(cid)

            return {
                "status": 201,
                "data": {
                    "success": True,
                    "message": f"Successfully imported {inserted_count} transactions",
                    "count": inserted_count
                }
            }

        elif method == 'POST':
            account_id = int(body['account_id'])
            category_id = int(body['category_id'])
            amount = float(body['amount'])
            tx_type = body.get('type', 'expense')
            date = body.get('date', datetime.now().strftime('%Y-%m-%d'))
            note = body.get('note', '')
            target_account_id = body.get('target_account_id')

            tx_id = execute_sql(
                "INSERT INTO transactions (account_id, category_id, amount, type, date, note, target_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (account_id, category_id, amount, tx_type, date, note, target_account_id)
            )

            # Update account balance
            if tx_type == 'income':
                execute_sql("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, account_id))
            elif tx_type == 'expense':
                execute_sql("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, account_id))
            elif tx_type == 'transfer' and target_account_id:
                execute_sql("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, account_id))
                execute_sql("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, target_account_id))

            if tx_type == 'expense':
                check_budget_alert(category_id)

            return {"status": 201, "data": query_one("SELECT * FROM transactions WHERE id = ?", (tx_id,))}

        elif method == 'DELETE' and resource_id:
            tx = query_one("SELECT * FROM transactions WHERE id = ?", (resource_id,))
            if tx:
                if tx['type'] == 'income':
                    execute_sql("UPDATE accounts SET balance = balance - ? WHERE id = ?", (tx['amount'], tx['account_id']))
                elif tx['type'] == 'expense':
                    execute_sql("UPDATE accounts SET balance = balance + ? WHERE id = ?", (tx['amount'], tx['account_id']))
                elif tx['type'] == 'transfer' and tx['target_account_id']:
                    execute_sql("UPDATE accounts SET balance = balance + ? WHERE id = ?", (tx['amount'], tx['account_id']))
                    execute_sql("UPDATE accounts SET balance = balance - ? WHERE id = ?", (tx['amount'], tx['target_account_id']))

                execute_sql("DELETE FROM transactions WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Transaction deleted"}}

    if resource == 'recurring':
        if method == 'GET':
            items = query_all("""
                SELECT r.*, a.name as account_name, c.name as category_name, c.icon as category_icon
                FROM recurring r
                JOIN accounts a ON r.account_id = a.id
                JOIN categories c ON r.category_id = c.id
                ORDER BY r.next_due ASC;
            """)
            return {"status": 200, "data": items}
        elif method == 'POST':
            name = body['name']
            account_id = int(body['account_id'])
            category_id = int(body['category_id'])
            amount = float(body['amount'])
            rec_type = body.get('type', 'expense')
            frequency = body.get('frequency', 'monthly')
            next_due = body.get('next_due', datetime.now().strftime('%Y-%m-%d'))
            rec_id = execute_sql(
                "INSERT INTO recurring (name, account_id, category_id, amount, type, frequency, next_due) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (name, account_id, category_id, amount, rec_type, frequency, next_due)
            )
            return {"status": 201, "data": query_one("SELECT * FROM recurring WHERE id = ?", (rec_id,))}
        elif method == 'PUT' and resource_id:
            current = query_one("SELECT * FROM recurring WHERE id = ?", (resource_id,))
            if not current:
                return {"status": 404, "data": {"error": "Item not found"}}
            active = (1 if body['active'] else 0) if 'active' in body else current['active']
            next_due = body.get('next_due', current['next_due'])
            amount = float(body.get('amount', current['amount']))
            name = body.get('name', current['name'])
            account_id = int(body.get('account_id', current['account_id']))
            category_id = int(body.get('category_id', current['category_id']))
            frequency = body.get('frequency', current['frequency'])
            rec_type = body.get('type', current['type'])
            execute_sql("""
                UPDATE recurring 
                SET active = ?, next_due = ?, amount = ?, name = ?, account_id = ?, category_id = ?, frequency = ?, type = ?
                WHERE id = ?
            """, (active, next_due, amount, name, account_id, category_id, frequency, rec_type, resource_id))
            return {"status": 200, "data": query_one("SELECT * FROM recurring WHERE id = ?", (resource_id,))}
        elif method == 'DELETE' and resource_id:
            execute_sql("DELETE FROM recurring WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Recurring item deleted"}}

    if resource == 'goals':
        if method == 'GET':
            goals = query_all("SELECT * FROM goals ORDER BY deadline ASC;")
            return {"status": 200, "data": goals}
        elif method == 'POST':
            name = body['name']
            target_amount = float(body['target_amount'])
            current_amount = float(body.get('current_amount', 0.0))
            deadline = body['deadline']
            color = body.get('color', '#10B981')
            goal_id = execute_sql(
                "INSERT INTO goals (name, target_amount, current_amount, deadline, color) VALUES (?, ?, ?, ?, ?)",
                (name, target_amount, current_amount, deadline, color)
            )
            return {"status": 201, "data": query_one("SELECT * FROM goals WHERE id = ?", (goal_id,))}
        elif method == 'PUT' and resource_id:
            if 'contribution' in body:
                contrib = float(body['contribution'])
                execute_sql("UPDATE goals SET current_amount = current_amount + ? WHERE id = ?", (contrib, resource_id))
                goal = query_one("SELECT * FROM goals WHERE id = ?", (resource_id,))
                if goal and goal['current_amount'] >= goal['target_amount']:
                    execute_sql("INSERT INTO notifications (type, title, message) VALUES ('milestone', 'Goal Completed!', ?)",
                                (f"Congratulations! You reached your goal for {goal['name']} (${goal['target_amount']:,.2f})",))
                return {"status": 200, "data": goal}
            else:
                name = body['name']
                target_amount = float(body['target_amount'])
                current_amount = float(body['current_amount'])
                deadline = body['deadline']
                color = body.get('color', '#10B981')
                execute_sql("UPDATE goals SET name = ?, target_amount = ?, current_amount = ?, deadline = ?, color = ? WHERE id = ?",
                            (name, target_amount, current_amount, deadline, color, resource_id))
                return {"status": 200, "data": query_one("SELECT * FROM goals WHERE id = ?", (resource_id,))}
        elif method == 'DELETE' and resource_id:
            execute_sql("DELETE FROM goals WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Goal deleted"}}

    if resource == 'notifications':
        if method == 'GET':
            check_debt_payment_alerts()
            notifs = query_all("SELECT * FROM notifications ORDER BY id DESC LIMIT 50;")
            return {"status": 200, "data": notifs}
        elif method == 'PUT' and resource_id and action == 'read':
            execute_sql("UPDATE notifications SET read = 1 WHERE id = ?", (resource_id,))
            return {"status": 200, "data": {"message": "Marked read"}}
        elif method == 'POST' and action == 'read-all':
            execute_sql("UPDATE notifications SET read = 1;")
            return {"status": 200, "data": {"message": "All marked read"}}


def compute_next_payment_date(due_day):
    today_dt = datetime.now()
    day = min(max(int(due_day or 1), 1), 28)
    target = datetime(today_dt.year, today_dt.month, day)
    today_str = today_dt.strftime('%Y-%m-%d')
    if target.strftime('%Y-%m-%d') < today_str:
        month = today_dt.month % 12 + 1
        year = today_dt.year + (1 if today_dt.month == 12 else 0)
        target = datetime(year, month, day)
    return target.strftime('%Y-%m-%d')


def advance_one_month(date_str):
    if not date_str:
        return None
    try:
        parts = date_str.split('-')
        year = int(parts[0])
        month = int(parts[1]) - 1  # 0-indexed
        day = int(parts[2])

        month += 1
        if month > 11:
            month = 0
            year += 1

        if month == 11:
            next_month_start = datetime(year + 1, 1, 1)
        else:
            next_month_start = datetime(year, month + 2, 1)
        last_day_of_month = (next_month_start - timedelta(days=1)).day
        clamped_day = min(day, last_day_of_month)
        return datetime(year, month + 1, clamped_day).strftime('%Y-%m-%d')
    except Exception:
        return None


def check_debt_payment_alerts():
    debts = query_all("SELECT * FROM debts WHERE current_balance > 0 AND next_payment_date IS NOT NULL AND next_payment_date != '';")
    today_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for d in debts:
        try:
            due_dt = datetime.strptime(d['next_payment_date'], '%Y-%m-%d')
        except Exception:
            continue
        diff_days = (due_dt - today_dt).days
        amount_val = d['minimum_payment'] if d['minimum_payment'] > 0 else d['current_balance']
        amount_str = f"€{amount_val:.2f}"

        if diff_days < 0:
            msg = f"{d['name']} payment of {amount_str} was due on {d['next_payment_date']}"
            existing = query_one("SELECT id FROM notifications WHERE title = 'Overdue Debt Payment' AND message = ?", (msg,))
            if not existing:
                execute_sql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Overdue Debt Payment', ?)", (msg,))
        elif diff_days == 0:
            msg = f"{d['name']} payment of {amount_str} is due today"
            existing = query_one("SELECT id FROM notifications WHERE title = 'Debt Payment Due Today' AND message = ?", (msg,))
            if not existing:
                execute_sql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Debt Payment Due Today', ?)", (msg,))
        elif diff_days <= 3:
            msg = f"{d['name']} payment of {amount_str} is due in {diff_days} day(s) on {d['next_payment_date']}"
            existing = query_one("SELECT id FROM notifications WHERE title = 'Upcoming Debt Payment' AND message = ?", (msg,))
            if not existing:
                execute_sql("INSERT INTO notifications (type, title, message) VALUES ('bill', 'Upcoming Debt Payment', ?)", (msg,))

    return {"status": 404, "data": {"error": "Endpoint not found"}}


def check_budget_alert(category_id):
    cat = query_one("SELECT * FROM categories WHERE id = ?", (category_id,))
    if not cat or cat['budget_limit'] <= 0:
        return

    month_str = datetime.now().strftime('%Y-%m')
    total_spent = query_one("""
        SELECT COALESCE(SUM(amount), 0) as spent 
        FROM transactions 
        WHERE category_id = ? AND type = 'expense' AND date LIKE ?;
    """, (category_id, f"{month_str}%"))['spent']

    limit = cat['budget_limit']
    pct = (total_spent / limit) * 100
    if pct >= 100:
        execute_sql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Budget Exceeded', ?)",
                    (f"You have exceeded your budget for {cat['name']} (${total_spent:,.2f} / ${limit:,.2f})",))
    elif pct >= 80:
        execute_sql("INSERT INTO notifications (type, title, message) VALUES ('alert', 'Budget Warning (80%)', ?)",
                    (f"You have reached {pct:.0f}% of your budget for {cat['name']}",))


def get_dashboard_summary():
    accts = query_all("SELECT balance FROM accounts;")
    total_assets = sum(a['balance'] for a in accts if a['balance'] > 0)
    debts = query_all("SELECT current_balance FROM debts;")
    total_debt = sum(d['current_balance'] for d in debts)
    net_worth = total_assets - total_debt

    current_month = datetime.now().strftime('%Y-%m')
    txs_month = query_all("SELECT type, amount FROM transactions WHERE date LIKE ?;", (f"{current_month}%",))
    month_income = sum(t['amount'] for t in txs_month if t['type'] == 'income')
    month_expense = sum(t['amount'] for t in txs_month if t['type'] == 'expense')
    month_savings = month_income - month_expense

    cats = query_all("SELECT id, name, budget_limit FROM categories WHERE type = 'expense' AND budget_limit > 0;")
    total_budget = sum(c['budget_limit'] for c in cats)
    total_spent_budget = 0
    for c in cats:
        spent = query_one("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE category_id = ? AND type = 'expense' AND date LIKE ?;",
                          (c['id'], f"{current_month}%"))['total']
        total_spent_budget += spent
    
    budget_usage_pct = (total_spent_budget / total_budget * 100) if total_budget > 0 else 0

    recent_txs = query_all("""
        SELECT t.*, a.name as account_name, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN categories c ON t.category_id = c.id
        ORDER BY t.date DESC, t.id DESC LIMIT 6;
    """)

    upcoming_bills = query_all("""
        SELECT r.*, a.name as account_name, c.name as category_name
        FROM recurring r
        JOIN accounts a ON r.account_id = a.id
        JOIN categories c ON r.category_id = c.id
        WHERE r.active = 1 AND r.type = 'expense'
        ORDER BY r.next_due ASC LIMIT 4;
    """)

    goals = query_all("SELECT * FROM goals ORDER BY deadline ASC LIMIT 3;")
    deadlines = query_all("SELECT * FROM deadlines WHERE status != 'completed' ORDER BY due_date ASC LIMIT 4;")
    analytics = get_analytics_data()['data']

    return {
        "status": 200,
        "data": {
            "net_worth": net_worth,
            "total_debt": total_debt,
            "month_income": month_income,
            "month_expense": month_expense,
            "month_savings": month_savings,
            "total_budget": total_budget,
            "total_spent_budget": total_spent_budget,
            "budget_usage_pct": round(budget_usage_pct, 1),
            "recent_transactions": recent_txs,
            "upcoming_bills": upcoming_bills,
            "upcoming_deadlines": deadlines,
            "goals": goals,
            "category_spending": analytics['category_spending'],
            "monthly_history": analytics['monthly_history']
        }
    }


def get_analytics_data():
    current_month = datetime.now().strftime('%Y-%m')

    cat_spending = query_all("""
        SELECT c.name, c.color, c.icon, c.expense_type, COALESCE(SUM(t.amount), 0) as total
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id AND t.type = 'expense' AND t.date LIKE ?
        WHERE c.type = 'expense'
        GROUP BY c.id
        HAVING total > 0
        ORDER BY total DESC;
    """, (f"{current_month}%",))

    top_cats = sorted(cat_spending, key=lambda x: x['total'], reverse=True)[:5]

    months = []
    dt = datetime.now()
    for i in range(5, -1, -1):
        m = (dt.year, dt.month - i)
        if m[1] <= 0:
            m = (m[0] - 1, m[1] + 12)
        m_str = f"{m[0]}:{m[1]:02d}".replace(':', '-')
        
        inc = query_one("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date LIKE ?;", (f"{m_str}%",))['total']
        exp = query_one("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date LIKE ?;", (f"{m_str}%",))['total']
        months.append({
            "month": m_str,
            "income": inc,
            "expense": exp
        })

    return {
        "status": 200,
        "data": {
            "category_spending": cat_spending,
            "top_categories": top_cats,
            "monthly_history": months
        }
    }


def get_needs_calculator_data():
    current_month = datetime.now().strftime('%Y-%m')
    
    # Income from recurring income rules or actual transactions
    rec_income = query_one("SELECT COALESCE(SUM(amount), 0) as total FROM recurring WHERE type = 'income' AND active = 1;")['total']
    actual_income = query_one("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date LIKE ?;", (f"{current_month}%",))['total']
    expected_income = max(rec_income, actual_income, 1.0)

    # Categories breakdown (Fixed, Variable, Discretionary)
    cats = query_all("SELECT * FROM categories WHERE type = 'expense';")
    fixed_budget = sum(c['budget_limit'] for c in cats if c['expense_type'] == 'fixed')
    var_budget = sum(c['budget_limit'] for c in cats if c['expense_type'] == 'variable')
    disc_budget = sum(c['budget_limit'] for c in cats if c['expense_type'] == 'discretionary')

    # Debt minimum payments
    debts = query_all("SELECT * FROM debts;")
    debt_minimums = sum(d['minimum_payment'] for d in debts)

    # Actual spending per expense_type this month
    fixed_actual = 0
    var_actual = 0
    disc_actual = 0

    for c in cats:
        spent = query_one("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE category_id = ? AND type = 'expense' AND date LIKE ?;", (c['id'], f"{current_month}%"))['total']
        if c['expense_type'] == 'fixed':
            fixed_actual += spent
        elif c['expense_type'] == 'variable':
            var_actual += spent
        else:
            disc_actual += spent

    total_fixed_needs = max(fixed_budget, fixed_actual) + debt_minimums
    total_variable_wants = max(var_budget + disc_budget, var_actual + disc_actual)
    total_needed = total_fixed_needs + total_variable_wants
    survival_cost = fixed_budget + debt_minimums

    # 50/30/20 comparison
    needs_pct = round((total_fixed_needs / expected_income) * 100, 1)
    wants_pct = round((total_variable_wants / expected_income) * 100, 1)
    savings_pct = round(max(0, 100 - needs_pct - wants_pct), 1)

    return {
        "status": 200,
        "data": {
            "expected_income": expected_income,
            "survival_cost": survival_cost,
            "fixed_needs": total_fixed_needs,
            "variable_wants": total_variable_wants,
            "debt_minimums": debt_minimums,
            "total_needed": total_needed,
            "net_gap": expected_income - total_needed,
            "ratios": {
                "needs_pct": needs_pct,
                "wants_pct": wants_pct,
                "savings_pct": savings_pct,
                "rec_needs_pct": 50,
                "rec_wants_pct": 30,
                "rec_savings_pct": 20
            },
            "categories": cats
        }
    }

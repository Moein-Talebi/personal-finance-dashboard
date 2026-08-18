const RecurringPage = {
  recurringItems: [],
  accounts: [],
  categories: [],
  filters: {
    search: '',
    status: 'all',
    sortBy: 'due_asc' // due_asc, due_desc, amount_desc, amount_asc, name_asc
  },

  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Loading recurring transactions...</div>`;

    try {
      const [recRes, acctRes, catRes] = await Promise.all([
        API.get('/api/recurring'),
        API.get('/api/accounts'),
        API.get('/api/categories')
      ]);

      this.recurringItems = recRes;
      this.accounts = acctRes;
      this.categories = catRes;

      this.renderTable(container);

    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load recurring items: ${err.message}</div>`;
    }
  },

  getSortedAndFilteredItems() {
    let items = [...this.recurringItems];

    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      items = items.filter(r =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.category_name && r.category_name.toLowerCase().includes(q)) ||
        (r.account_name && r.account_name.toLowerCase().includes(q))
      );
    }

    if (this.filters.status === 'active') {
      items = items.filter(r => r.active === 1 || r.active === true);
    } else if (this.filters.status === 'paused') {
      items = items.filter(r => r.active === 0 || r.active === false);
    }

    items.sort((a, b) => {
      if (this.filters.sortBy === 'due_asc') {
        return (a.next_due || '').localeCompare(b.next_due || '');
      } else if (this.filters.sortBy === 'due_desc') {
        return (b.next_due || '').localeCompare(a.next_due || '');
      } else if (this.filters.sortBy === 'amount_desc') {
        return parseFloat(b.amount || 0) - parseFloat(a.amount || 0);
      } else if (this.filters.sortBy === 'amount_asc') {
        return parseFloat(a.amount || 0) - parseFloat(b.amount || 0);
      } else if (this.filters.sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return items;
  },

  getArrivalBadge(dueDateStr, active) {
    if (!dueDateStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dueDateStr.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (!active) {
      return `<span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:2px;">Paused</span>`;
    }

    if (diffDays < 0) {
      return `<span style="font-size:0.7rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:var(--radius-full); background:rgba(239, 68, 68, 0.15); color:var(--color-danger); display:inline-block; margin-top:2px;">${Math.abs(diffDays)}d overdue</span>`;
    } else if (diffDays === 0) {
      return `<span style="font-size:0.7rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:var(--radius-full); background:rgba(245, 158, 11, 0.15); color:var(--color-warning); display:inline-flex; align-items:center; gap:0.2rem; margin-top:2px;"><i data-lucide="zap" style="width:11px; height:11px;"></i> Due Today</span>`;
    } else if (diffDays === 1) {
      return `<span style="font-size:0.7rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:var(--radius-full); background:rgba(245, 158, 11, 0.15); color:var(--color-warning); display:inline-block; margin-top:2px;">Tomorrow</span>`;
    } else {
      return `<span style="font-size:0.7rem; font-weight:600; padding:0.15rem 0.45rem; border-radius:var(--radius-full); background:rgba(59, 130, 246, 0.12); color:var(--color-info); display:inline-block; margin-top:2px;">In ${diffDays} days</span>`;
    }
  },

  renderTable(container) {
    const formatCurrency = (val) => {
      const num = parseFloat(val || 0);
      return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const displayedItems = this.getSortedAndFilteredItems();

    // Calculate due soon in next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueSoonItems = this.recurringItems.filter(r => {
      if (!r.active || !r.next_due) return false;
      const [y, m, d] = r.next_due.split('-').map(Number);
      const due = new Date(y, m - 1, d);
      due.setHours(0, 0, 0, 0);
      const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    });
    const dueSoonTotal = dueSoonItems.reduce((sum, r) => sum + (r.type === 'expense' ? r.amount : 0), 0);

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:700;">Recurring Bills & Subscriptions</h2>
          <p style="color:var(--text-muted); font-size:0.88rem;">Automate fixed monthly expenses, subscriptions, and recurring income</p>
        </div>

        <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
          <button class="btn btn-secondary" id="add-subscription-btn">
            <i data-lucide="repeat"></i> + Monthly Subscription
          </button>
          <button class="btn btn-primary" id="add-recurring-btn">
            <i data-lucide="plus"></i> Add Recurring Item
          </button>
        </div>
      </div>

      <!-- Due Soon Summary Banner -->
      ${dueSoonItems.length > 0 ? `
        <div class="card" style="margin-bottom:1.25rem; padding:0.9rem 1.25rem; background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.3); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <div style="width:32px; height:32px; border-radius:var(--radius-full); background:rgba(245, 158, 11, 0.18); color:var(--color-warning); display:flex; align-items:center; justify-content:center;">
              <i data-lucide="alert-triangle" style="width:16px; height:16px;"></i>
            </div>
            <div>
              <span style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${dueSoonItems.length} payment(s) arriving in the next 7 days</span>
              <span style="font-size:0.78rem; color:var(--text-muted); display:block;">Total upcoming expense: <strong>${formatCurrency(dueSoonTotal)}</strong></span>
            </div>
          </div>
          <a href="#deadlines" style="font-size:0.82rem; font-weight:700; color:var(--color-primary); display:inline-flex; align-items:center; gap:0.3rem;">
            <span>View in Deadlines</span> <i data-lucide="arrow-right" style="width:14px; height:14px;"></i>
          </a>
        </div>
      ` : ''}

      <!-- Search, Filter & Sort Controls -->
      <div class="card" style="margin-bottom:1.25rem; padding:1rem 1.25rem;">
        <div style="display:flex; flex-wrap:wrap; gap:1rem; align-items:center; justify-content:space-between;">
          <div style="display:flex; flex-wrap:wrap; gap:0.75rem; align-items:center; flex:1; min-width:280px;">
            <input type="text" id="rec-search" class="form-control" style="max-width:220px;" placeholder="Search recurring..." value="${this.filters.search}">
            
            <select id="rec-status-filter" class="form-control" style="max-width:140px;">
              <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>All Status</option>
              <option value="active" ${this.filters.status === 'active' ? 'selected' : ''}>Active Only</option>
              <option value="paused" ${this.filters.status === 'paused' ? 'selected' : ''}>Paused Only</option>
            </select>
          </div>

          <div style="display:flex; align-items:center; gap:0.6rem;">
            <label for="rec-sort" style="font-size:0.85rem; color:var(--text-secondary); font-weight:600; white-space:nowrap; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="arrow-up-down" style="width:15px; height:15px;"></i> Sort by:
            </label>
            <select id="rec-sort" class="form-control" style="max-width:260px;">
              <option value="due_asc" ${this.filters.sortBy === 'due_asc' ? 'selected' : ''}>Arrival Date (Soonest first)</option>
              <option value="due_desc" ${this.filters.sortBy === 'due_desc' ? 'selected' : ''}>Arrival Date (Furthest first)</option>
              <option value="amount_desc" ${this.filters.sortBy === 'amount_desc' ? 'selected' : ''}>Amount (High to Low)</option>
              <option value="amount_asc" ${this.filters.sortBy === 'amount_asc' ? 'selected' : ''}>Amount (Low to High)</option>
              <option value="name_asc" ${this.filters.sortBy === 'name_asc' ? 'selected' : ''}>Name (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Frequency</th>
                <th>Account</th>
                <th>Category</th>
                <th id="th-sort-due" style="cursor:pointer; user-select:none;" title="Click to toggle Arrival Date sorting">
                  Arrival / Next Due
                  <i data-lucide="${this.filters.sortBy === 'due_asc' ? 'arrow-up' : (this.filters.sortBy === 'due_desc' ? 'arrow-down' : 'arrow-up-down')}" style="width:13px; height:13px; vertical-align:-2px; margin-left:3px;"></i>
                </th>
                <th>Status</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:center; width:120px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayedItems.length === 0 ? '<tr><td colspan="8" style="color:var(--text-muted); text-align:center; padding:2rem;">No recurring items match criteria</td></tr>' : displayedItems.map(r => `
                <tr>
                  <td style="font-weight:600;">${r.name}</td>
                  <td>
                    <span style="font-size:0.75rem; text-transform:capitalize; padding:0.2rem 0.5rem; background:var(--bg-tertiary); border-radius:var(--radius-full);">${r.frequency}</span>
                  </td>
                  <td style="color:var(--text-muted); font-size:0.85rem;">${r.account_name}</td>
                  <td style="color:var(--text-muted); font-size:0.85rem;">${r.category_name}</td>
                  <td style="color:var(--text-secondary); font-size:0.85rem;">
                    <strong>${r.next_due}</strong>
                    <div>${this.getArrivalBadge(r.next_due, r.active)}</div>
                  </td>
                  <td>
                    <span style="font-size:0.75rem; font-weight:600; padding:0.2rem 0.5rem; border-radius:var(--radius-full); background:${r.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)'}; color:${r.active ? 'var(--color-success)' : 'var(--text-muted)'};">
                      ${r.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td style="text-align:right; font-weight:700; color:${r.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)'};">
                    ${r.type === 'income' ? '+' : '-'}${formatCurrency(r.amount)}
                  </td>
                  <td style="text-align:center;">
                    <div style="display:flex; justify-content:center; align-items:center; gap:0.4rem;">
                      <button class="btn btn-sm btn-secondary pay-rec-btn" data-id="${r.id}" style="font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:var(--radius-full); gap:0.3rem;" title="Log payment & advance due date">
                        <i data-lucide="check-circle" style="width:13px; height:13px;"></i> Pay
                      </button>
                      <button class="icon-btn toggle-rec-btn" data-id="${r.id}" data-active="${r.active}" style="width:30px; height:30px; border:none; background:transparent;" title="Toggle Active/Pause">
                        <i data-lucide="${r.active ? 'pause-circle' : 'play-circle'}" style="width:16px; height:16px;"></i>
                      </button>
                      <button class="icon-btn delete-rec-btn" data-id="${r.id}" style="width:30px; height:30px; border:none; background:transparent; color:var(--color-danger);" title="Delete">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    this.attachEvents(container);
  },

  attachEvents(container) {
    document.getElementById('add-recurring-btn')?.addEventListener('click', () => this.openRecurringModal());
    document.getElementById('add-subscription-btn')?.addEventListener('click', () => this.openRecurringModal({ isSubscription: true }));

    // Search and filters
    const searchInput = document.getElementById('rec-search');
    searchInput?.addEventListener('input', (e) => {
      this.filters.search = e.target.value;
      this.renderTable(container);
      const searchBox = document.getElementById('rec-search');
      if (searchBox) {
        searchBox.focus();
        searchBox.setSelectionRange(searchBox.value.length, searchBox.value.length);
      }
    });

    const statusFilter = document.getElementById('rec-status-filter');
    statusFilter?.addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.renderTable(container);
    });

    const sortSelect = document.getElementById('rec-sort');
    sortSelect?.addEventListener('change', (e) => {
      this.filters.sortBy = e.target.value;
      this.renderTable(container);
    });

    // Header click sort toggle
    document.getElementById('th-sort-due')?.addEventListener('click', () => {
      this.filters.sortBy = (this.filters.sortBy === 'due_asc') ? 'due_desc' : 'due_asc';
      this.renderTable(container);
    });

    container.addEventListener('click', async (e) => {
      const payBtn = e.target.closest('.pay-rec-btn');
      if (payBtn) {
        const id = parseInt(payBtn.getAttribute('data-id'));
        const item = this.recurringItems.find(r => r.id === id);
        if (item) {
          this.openLogPaymentModal(item);
        }
        return;
      }

      const toggleBtn = e.target.closest('.toggle-rec-btn');
      if (toggleBtn) {
        const id = parseInt(toggleBtn.getAttribute('data-id'));
        const active = parseInt(toggleBtn.getAttribute('data-active')) === 1;
        await API.put(`/api/recurring/${id}`, { active: !active });
        Toast.show(active ? 'Recurring item paused' : 'Recurring item activated', 'info');
        this.render(container);
      }

      const deleteBtn = e.target.closest('.delete-rec-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'));
        if (confirm('Delete this recurring rule?')) {
          await API.delete(`/api/recurring/${id}`);
          Toast.show('Recurring rule deleted', 'success');
          this.render(container);
        }
      }
    });
  },

  calculateNextDueDate(currentDueDateStr, frequency) {
    if (!currentDueDateStr) {
      currentDueDateStr = new Date().toISOString().split('T')[0];
    }
    const [year, month, day] = currentDueDateStr.split('-').map(Number);
    const dt = new Date(year, month - 1, day);

    if (frequency === 'monthly') {
      dt.setMonth(dt.getMonth() + 1);
    } else if (frequency === 'weekly') {
      dt.setDate(dt.getDate() + 7);
    } else if (frequency === 'bi-weekly') {
      dt.setDate(dt.getDate() + 14);
    } else if (frequency === 'yearly') {
      dt.setFullYear(dt.getFullYear() + 1);
    } else if (frequency === 'daily') {
      dt.setDate(dt.getDate() + 1);
    }

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  openLogPaymentModal(rec) {
    const today = new Date().toISOString().split('T')[0];
    const nextCalculatedDue = this.calculateNextDueDate(rec.next_due || today, rec.frequency);

    const contentHTML = `
      <form id="log-payment-form">
        <div style="background:var(--bg-tertiary, #f8f9fd); padding:0.85rem 1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--border-color);">
          <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.25rem;">${rec.name}</div>
          <div style="font-size:0.82rem; color:var(--text-muted); display:flex; gap:0.75rem; flex-wrap:wrap;">
            <span><strong>Current Due:</strong> ${rec.next_due}</span>
            <span><strong>Frequency:</strong> <span style="text-transform:capitalize;">${rec.frequency}</span></span>
          </div>
        </div>

        <div class="form-group">
          <label>Actual Amount Paid (€) <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(Enter this month's exact bill amount)</span></label>
          <input type="number" step="0.01" id="log-rec-amount" class="form-control" value="${rec.amount || ''}" placeholder="0.00" required autofocus>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Payment Date</label>
            <input type="date" id="log-rec-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label>Account</label>
            <select id="log-rec-account" class="form-control">
              ${this.accounts.map(a => `<option value="${a.id}" ${a.id === rec.account_id ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select id="log-rec-category" class="form-control">
              ${this.categories.map(c => `<option value="${c.id}" ${c.id === rec.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Advance Next Due Date To</label>
            <input type="date" id="log-rec-next-due" class="form-control" value="${nextCalculatedDue}" required>
          </div>
        </div>

        <div class="form-group">
          <label>Memo / Note</label>
          <input type="text" id="log-rec-note" class="form-control" value="${rec.name} payment (${new Date().toLocaleString('default', { month: 'short', year: 'numeric' })})">
        </div>
      </form>
    `;

    Modal.open({
      title: `Log Payment: ${rec.name}`,
      saveText: 'Confirm & Log Payment',
      contentHTML,
      onSave: async () => {
        const amount = parseFloat(document.getElementById('log-rec-amount').value || 0);
        const date = document.getElementById('log-rec-date').value;
        const account_id = document.getElementById('log-rec-account').value;
        const category_id = document.getElementById('log-rec-category').value;
        const next_due = document.getElementById('log-rec-next-due').value;
        const note = document.getElementById('log-rec-note').value;

        if (amount <= 0) {
          Toast.show('Please enter a valid positive payment amount', 'warning');
          return false;
        }

        // 1. Record the transaction in the ledger
        await API.post('/api/transactions', {
          account_id,
          category_id,
          amount,
          type: rec.type || 'expense',
          date,
          note
        });

        // 2. Advance the recurring rule's next_due date
        await API.put(`/api/recurring/${rec.id}`, {
          next_due
        });

        Toast.show(`Payment of €${amount.toFixed(2)} recorded! Next due date moved to ${next_due}.`, 'success');

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  },

  openRecurringModal(options = {}) {
    const today = new Date().toISOString().split('T')[0];

    const contentHTML = `
      <form id="recurring-form">
        <!-- Quick Preset Section -->
        <div style="background:var(--bg-tertiary, #f8f9fd); padding:0.85rem 1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--border-color);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); display:flex; align-items:center; gap:0.4rem;">
              <i data-lucide="zap" style="width:14px; height:14px; color:var(--color-primary);"></i> Quick Preset
            </span>
            <span style="font-size:0.75rem; color:var(--text-muted);">One-click fill</span>
          </div>

          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.75rem;">
            <button type="button" class="btn ${options.isSubscription ? 'btn-primary' : 'btn-outline'}" id="preset-monthly-sub-btn" style="font-size:0.82rem; padding:0.4rem 0.85rem; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:0.4rem;">
              <i data-lucide="repeat" style="width:14px; height:14px;"></i> Monthly Subscription
            </button>
            <button type="button" class="btn btn-outline" id="preset-monthly-salary-btn" style="font-size:0.82rem; padding:0.4rem 0.85rem; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:0.4rem;">
              <i data-lucide="wallet" style="width:14px; height:14px;"></i> Monthly Income / Salary
            </button>
          </div>

          <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
            <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Popular:</span>
            <button type="button" class="quick-sub-chip" data-name="Netflix" data-cat="Entertainment & Subscriptions" style="font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:var(--radius-full); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary); cursor:pointer;">Netflix</button>
            <button type="button" class="quick-sub-chip" data-name="Spotify" data-cat="Entertainment & Subscriptions" style="font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:var(--radius-full); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary); cursor:pointer;">Spotify</button>
            <button type="button" class="quick-sub-chip" data-name="YouTube Premium" data-cat="Entertainment & Subscriptions" style="font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:var(--radius-full); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary); cursor:pointer;">YouTube</button>
            <button type="button" class="quick-sub-chip" data-name="Gym Membership" data-cat="Entertainment & Subscriptions" style="font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:var(--radius-full); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary); cursor:pointer;">Gym</button>
            <button type="button" class="quick-sub-chip" data-name="iCloud Storage" data-cat="Entertainment & Subscriptions" style="font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:var(--radius-full); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary); cursor:pointer;">iCloud</button>
            <button type="button" class="quick-sub-chip" data-name="Internet / Wi-Fi" data-cat="Utilities & Internet" style="font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:var(--radius-full); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary); cursor:pointer;">Internet</button>
          </div>
        </div>

        <div class="form-group">
          <label>Name / Description</label>
          <input type="text" id="modal-rec-name" class="form-control" placeholder="e.g. Netflix Subscription" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select id="modal-rec-type" class="form-control">
              <option value="expense">Expense (Bill / Subscription)</option>
              <option value="income">Income (Salary / Deposit)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Amount (€)</label>
            <input type="number" step="0.01" id="modal-rec-amount" class="form-control" placeholder="0.00" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Frequency</label>
            <select id="modal-rec-frequency" class="form-control">
              <option value="monthly" selected>Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div class="form-group">
            <label>Next Due Date</label>
            <input type="date" id="modal-rec-next-due" class="form-control" value="${today}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Account</label>
            <select id="modal-rec-account" class="form-control">
              ${this.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="modal-rec-category" class="form-control">
              ${this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: options.isSubscription ? 'Add Monthly Subscription' : 'Add Recurring Rule',
      contentHTML,
      onSave: async () => {
        const name = document.getElementById('modal-rec-name').value;
        const type = document.getElementById('modal-rec-type').value;
        const amount = parseFloat(document.getElementById('modal-rec-amount').value || 0);
        const frequency = document.getElementById('modal-rec-frequency').value;
        const next_due = document.getElementById('modal-rec-next-due').value;
        const account_id = document.getElementById('modal-rec-account').value;
        const category_id = document.getElementById('modal-rec-category').value;

        if (!name || amount <= 0) {
          Toast.show('Name and positive amount are required', 'warning');
          return false;
        }

        await API.post('/api/recurring', { name, type, amount, frequency, next_due, account_id, category_id });
        Toast.show('Recurring rule added!', 'success');

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });

    const setMonthlySubscriptionPreset = () => {
      const typeEl = document.getElementById('modal-rec-type');
      const freqEl = document.getElementById('modal-rec-frequency');
      const catEl = document.getElementById('modal-rec-category');
      const nameEl = document.getElementById('modal-rec-name');

      if (typeEl) typeEl.value = 'expense';
      if (freqEl) freqEl.value = 'monthly';

      if (catEl) {
        const subCat = this.categories.find(c =>
          c.name.toLowerCase().includes('subscription') ||
          c.name.toLowerCase().includes('entertainment')
        );
        if (subCat) catEl.value = subCat.id;
      }

      const subBtn = document.getElementById('preset-monthly-sub-btn');
      const salaryBtn = document.getElementById('preset-monthly-salary-btn');
      if (subBtn) {
        subBtn.classList.remove('btn-outline');
        subBtn.classList.add('btn-primary');
      }
      if (salaryBtn) {
        salaryBtn.classList.add('btn-outline');
        salaryBtn.classList.remove('btn-primary');
      }
      if (nameEl && !nameEl.value) {
        nameEl.placeholder = 'e.g. Netflix, Spotify, Gym';
      }
    };

    const setMonthlySalaryPreset = () => {
      const typeEl = document.getElementById('modal-rec-type');
      const freqEl = document.getElementById('modal-rec-frequency');
      const catEl = document.getElementById('modal-rec-category');

      if (typeEl) typeEl.value = 'income';
      if (freqEl) freqEl.value = 'monthly';

      if (catEl) {
        const salaryCat = this.categories.find(c =>
          c.name.toLowerCase().includes('salary') ||
          c.name.toLowerCase().includes('income')
        );
        if (salaryCat) catEl.value = salaryCat.id;
      }

      const subBtn = document.getElementById('preset-monthly-sub-btn');
      const salaryBtn = document.getElementById('preset-monthly-salary-btn');
      if (salaryBtn) {
        salaryBtn.classList.remove('btn-outline');
        salaryBtn.classList.add('btn-primary');
      }
      if (subBtn) {
        subBtn.classList.add('btn-outline');
        subBtn.classList.remove('btn-primary');
      }
    };

    document.getElementById('preset-monthly-sub-btn')?.addEventListener('click', setMonthlySubscriptionPreset);
    document.getElementById('preset-monthly-salary-btn')?.addEventListener('click', setMonthlySalaryPreset);

    document.querySelectorAll('.quick-sub-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        setMonthlySubscriptionPreset();
        const nameInput = document.getElementById('modal-rec-name');
        if (nameInput) {
          nameInput.value = chip.getAttribute('data-name');
          nameInput.focus();
        }
        const targetCat = chip.getAttribute('data-cat');
        const catEl = document.getElementById('modal-rec-category');
        if (catEl && targetCat) {
          const matched = this.categories.find(c => c.name.toLowerCase() === targetCat.toLowerCase());
          if (matched) catEl.value = matched.id;
        }
      });
    });

    if (options.isSubscription) {
      setMonthlySubscriptionPreset();
    }
  }
};

const RecurringPage = {
  recurringItems: [],
  accounts: [],
  categories: [],

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

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '$' + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:700;">Recurring Bills & Subscriptions</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Automate fixed monthly expenses and recurring income</p>
          </div>

          <button class="btn btn-primary" id="add-recurring-btn">
            <i data-lucide="plus"></i> Add Recurring Item
          </button>
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
                  <th>Next Due</th>
                  <th>Status</th>
                  <th style="text-align:right;">Amount</th>
                  <th style="text-align:center; width:100px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.recurringItems.length === 0 ? '<tr><td colspan="8" style="color:var(--text-muted); text-align:center; padding:2rem;">No recurring items configured</td></tr>' : this.recurringItems.map(r => `
                  <tr>
                    <td style="font-weight:600;">${r.name}</td>
                    <td>
                      <span style="font-size:0.75rem; text-transform:capitalize; padding:0.2rem 0.5rem; background:var(--bg-tertiary); border-radius:var(--radius-full);">${r.frequency}</span>
                    </td>
                    <td style="color:var(--text-muted); font-size:0.85rem;">${r.account_name}</td>
                    <td style="color:var(--text-muted); font-size:0.85rem;">${r.category_name}</td>
                    <td style="color:var(--text-secondary); font-size:0.85rem;">${r.next_due}</td>
                    <td>
                      <span style="font-size:0.75rem; font-weight:600; padding:0.2rem 0.5rem; border-radius:var(--radius-full); background:${r.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)'}; color:${r.active ? 'var(--color-success)' : 'var(--text-muted)'};">
                        ${r.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td style="text-align:right; font-weight:700; color:${r.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)'};">
                      ${r.type === 'income' ? '+' : '-'}${formatCurrency(r.amount)}
                    </td>
                    <td style="text-align:center;">
                      <div style="display:flex; justify-content:center; gap:0.4rem;">
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

    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load recurring items: ${err.message}</div>`;
    }
  },

  attachEvents(container) {
    document.getElementById('add-recurring-btn').addEventListener('click', () => this.openRecurringModal());

    container.addEventListener('click', async (e) => {
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

  openRecurringModal() {
    const today = new Date().toISOString().split('T')[0];

    const contentHTML = `
      <form id="recurring-form">
        <div class="form-group">
          <label>Name / Description</label>
          <input type="text" id="modal-rec-name" class="form-control" placeholder="e.g. Netflix Subscription" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select id="modal-rec-type" class="form-control">
              <option value="expense">Expense (Bill)</option>
              <option value="income">Income (Salary)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Amount ($)</label>
            <input type="number" step="0.01" id="modal-rec-amount" class="form-control" placeholder="0.00" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Frequency</label>
            <select id="modal-rec-frequency" class="form-control">
              <option value="monthly">Monthly</option>
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
      title: 'Add Recurring Rule',
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
  }
};

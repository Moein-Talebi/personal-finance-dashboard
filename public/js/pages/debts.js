const DebtTrackerPage = {
  debts: [],
  accounts: [],

  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Loading debt payoff tracker...</div>`;

    try {
      const [debtRes, acctRes] = await Promise.all([
        API.get('/api/debts'),
        API.get('/api/accounts')
      ]);

      this.debts = debtRes;
      this.accounts = acctRes;

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const totalDebt = this.debts.reduce((sum, d) => sum + d.current_balance, 0);
      const totalMinPayments = this.debts.reduce((sum, d) => sum + d.minimum_payment, 0);

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:700;">Debt Tracker & Payoff Manager</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Track loans, balances, interest rates, and payoff progress</p>
          </div>

          <button class="btn btn-primary" id="add-debt-btn">
            <i data-lucide="plus"></i> Add Debt
          </button>
        </div>

        <div class="grid-cols-4" style="margin-bottom:1.5rem;">
          <div class="card stat-card">
            <div class="stat-header">
              <span>Total Remaining Debt</span>
              <div class="stat-icon danger"><i data-lucide="credit-card"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-danger);">${formatCurrency(totalDebt)}</div>
            <div class="stat-sub">Across ${this.debts.length} debt accounts</div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Monthly Minimum Payments</span>
              <div class="stat-icon warning"><i data-lucide="calendar"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-warning);">${formatCurrency(totalMinPayments)}</div>
            <div class="stat-sub">Required monthly obligation</div>
          </div>
        </div>

        <div class="grid-cols-2">
          ${this.debts.length === 0 ? '<div class="card" style="grid-column:1/-1; color:var(--text-muted);">No debt records found ðŸŽ‰</div>' : this.debts.map(d => {
            const paidDown = Math.max(0, d.total_amount - d.current_balance);
            const pct = d.total_amount > 0 ? Math.min(100, Math.round((paidDown / d.total_amount) * 100)) : 0;

            return `
              <div class="card" style="display:flex; flex-direction:column; gap:1.25rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:0.85rem;">
                    <div style="width:44px; height:44px; border-radius:var(--radius-md); background:${d.color}22; color:${d.color}; display:flex; align-items:center; justify-content:center;">
                      <i data-lucide="credit-card"></i>
                    </div>
                    <div>
                      <h3 style="font-size:1.1rem; font-weight:700;">${d.name}</h3>
                      <span style="font-size:0.78rem; color:var(--color-warning); font-weight:600;">${d.interest_rate}% APR</span>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.4rem;">
                    <button class="icon-btn edit-debt-btn" data-id="${d.id}" style="width:32px; height:32px;">
                      <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
                    </button>
                    <button class="icon-btn delete-debt-btn" data-id="${d.id}" style="width:32px; height:32px; color:var(--color-danger);">
                      <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:0.3rem;">
                    <span>Owed: <strong style="color:var(--color-danger);">${formatCurrency(d.current_balance)}</strong></span>
                    <span>Original: <strong>${formatCurrency(d.total_amount)}</strong></span>
                  </div>

                  <div class="progress-bar-bg" style="height:10px;">
                    <div class="progress-bar-fill" style="width:${pct}%; background-color:var(--color-success);"></div>
                  </div>

                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem;">
                    <span>${pct}% paid off (${formatCurrency(paidDown)})</span>
                    <span>Min payment: ${formatCurrency(d.minimum_payment)}/mo</span>
                  </div>
                </div>

                <div style="display:flex; justify-content:flex-end;">
                  <button class="btn btn-primary btn-sm make-payment-btn" data-id="${d.id}">
                    <i data-lucide="dollar-sign"></i> Make Payment
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      if (window.lucide) lucide.createIcons();
      this.attachEvents(container);

    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load debts: ${err.message}</div>`;
    }
  },

  attachEvents(container) {
    document.getElementById('add-debt-btn').addEventListener('click', () => this.openDebtModal());

    container.addEventListener('click', async (e) => {
      const paymentBtn = e.target.closest('.make-payment-btn');
      if (paymentBtn) {
        const id = parseInt(paymentBtn.getAttribute('data-id'));
        const debt = this.debts.find(d => d.id === id);
        if (debt) this.openPaymentModal(debt);
      }

      const editBtn = e.target.closest('.edit-debt-btn');
      if (editBtn) {
        const id = parseInt(editBtn.getAttribute('data-id'));
        const debt = this.debts.find(d => d.id === id);
        if (debt) this.openDebtModal(debt);
      }

      const deleteBtn = e.target.closest('.delete-debt-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'));
        if (confirm('Delete this debt record?')) {
          await API.delete(`/api/debts/${id}`);
          Toast.show('Debt record deleted', 'success');
          this.render(container);
        }
      }
    });
  },

  openDebtModal(debt = null) {
    const isEdit = !!debt;

    const contentHTML = `
      <form id="debt-form">
        <div class="form-group">
          <label>Debt Name</label>
          <input type="text" id="modal-debt-name" class="form-control" value="${debt ? debt.name : ''}" placeholder="e.g. Car Loan, Credit Card" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Original Total ($)</label>
            <input type="number" step="0.01" id="modal-debt-total" class="form-control" value="${debt ? debt.total_amount : 1000}" required>
          </div>
          <div class="form-group">
            <label>Current Balance ($)</label>
            <input type="number" step="0.01" id="modal-debt-balance" class="form-control" value="${debt ? debt.current_balance : 1000}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Interest Rate (% APR)</label>
            <input type="number" step="0.1" id="modal-debt-rate" class="form-control" value="${debt ? debt.interest_rate : 5.0}">
          </div>
          <div class="form-group">
            <label>Minimum Monthly Payment ($)</label>
            <input type="number" step="0.01" id="modal-debt-min" class="form-control" value="${debt ? debt.minimum_payment : 50}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Due Day of Month (1-31)</label>
            <input type="number" min="1" max="31" id="modal-debt-day" class="form-control" value="${debt ? debt.due_day : 1}">
          </div>
          <div class="form-group">
            <label>Color Theme</label>
            <input type="color" id="modal-debt-color" class="form-control" value="${debt ? debt.color : '#EF4444'}" style="height:42px; padding:0.2rem;">
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: isEdit ? `Edit Debt: ${debt.name}` : 'Add Debt Record',
      contentHTML,
      onSave: async () => {
        const name = document.getElementById('modal-debt-name').value;
        const total_amount = parseFloat(document.getElementById('modal-debt-total').value || 0);
        const current_balance = parseFloat(document.getElementById('modal-debt-balance').value || 0);
        const interest_rate = parseFloat(document.getElementById('modal-debt-rate').value || 0);
        const minimum_payment = parseFloat(document.getElementById('modal-debt-min').value || 0);
        const due_day = int(document.getElementById('modal-debt-day').value || 1);
        const color = document.getElementById('modal-debt-color').value;

        if (!name || total_amount <= 0) {
          Toast.show('Valid debt name and total amount are required', 'warning');
          return false;
        }

        if (isEdit) {
          await API.put(`/api/debts/${debt.id}`, { name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color });
          Toast.show('Debt record updated!', 'success');
        } else {
          await API.post('/api/debts', { name, total_amount, current_balance, interest_rate, minimum_payment, due_day, color });
          Toast.show('Debt record created!', 'success');
        }

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  },

  openPaymentModal(debt) {
    const contentHTML = `
      <form id="debt-pay-form">
        <div class="form-group">
          <label>Payment Amount ($)</label>
          <input type="number" step="0.01" id="pay-amount" class="form-control" value="${debt.minimum_payment || 50}" required>
        </div>

        <div class="form-group">
          <label>Pay From Account</label>
          <select id="pay-account" class="form-control">
            <option value="">Do not deduct from bank account</option>
            ${this.accounts.map(a => `<option value="${a.id}">${a.name} ($${a.balance.toFixed(2)})</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    Modal.open({
      title: `Record Debt Payment: ${debt.name}`,
      contentHTML,
      onSave: async () => {
        const amount = parseFloat(document.getElementById('pay-amount').value || 0);
        const account_id = document.getElementById('pay-account').value;

        if (!amount || amount <= 0) {
          Toast.show('Please enter a valid payment amount', 'warning');
          return false;
        }

        await API.put(`/api/debts/${debt.id}/payment`, { amount, account_id });
        Toast.show(`Payment of $${amount.toFixed(2)} recorded for ${debt.name}!`, 'success');

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  }
};

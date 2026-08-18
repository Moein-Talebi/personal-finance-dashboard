const DebtTrackerPage = {
  debts: [],
  accounts: [],
  expandedHistories: {},

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

      const totalDebt = this.debts.reduce((sum, d) => sum + (d.current_balance || 0), 0);
      const totalMinPayments = this.debts.reduce((sum, d) => sum + (d.minimum_payment || 0), 0);

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:700;">Debt Tracker & Borrowed Money</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Track personal borrowed money, loans, installment payments, and payoff history</p>
          </div>

          <button class="btn btn-primary" id="add-debt-btn">
            <i data-lucide="plus"></i> Add Debt / Borrowed Money
          </button>
        </div>

        <div class="grid-cols-4" style="margin-bottom:1.5rem;">
          <div class="card stat-card">
            <div class="stat-header">
              <span>Total Remaining Debt</span>
              <div class="stat-icon danger"><i data-lucide="credit-card"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-danger);">${formatCurrency(totalDebt)}</div>
            <div class="stat-sub">Across ${this.debts.length} active debt accounts</div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Monthly Minimum Payments</span>
              <div class="stat-icon warning"><i data-lucide="calendar"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-warning);">${formatCurrency(totalMinPayments)}</div>
            <div class="stat-sub">Estimated monthly installment obligation</div>
          </div>
        </div>

        <div class="grid-cols-2">
          ${this.debts.length === 0 ? `
            <div class="card" style="grid-column:1/-1; color:var(--text-muted); text-align:center; padding:3rem 1.5rem;">
              <div style="width:48px; height:48px; border-radius:var(--radius-full); background:var(--bg-tertiary); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.75rem;">
                <i data-lucide="check-circle-2" style="width:24px; height:24px; color:var(--color-success);"></i>
              </div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary);">No Debt Records</div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">You currently have no borrowed money or loan accounts configured.</p>
            </div>
          ` : this.debts.map(d => {
            const paidDown = Math.max(0, (d.total_amount || 0) - (d.current_balance || 0));
            const pct = d.total_amount > 0 ? Math.min(100, Math.round((paidDown / d.total_amount) * 100)) : 0;
            const payments = d.payments || [];
            const isHistoryOpen = !!this.expandedHistories[d.id];
            const isFullyPaid = d.current_balance <= 0;

            return `
              <div class="card" style="display:flex; flex-direction:column; gap:1.25rem; border:1px solid ${isFullyPaid ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:0.85rem;">
                    <div style="width:44px; height:44px; border-radius:var(--radius-md); background:${d.color || '#EF4444'}22; color:${d.color || '#EF4444'}; display:flex; align-items:center; justify-content:center;">
                      <i data-lucide="${d.interest_rate > 0 ? 'landmark' : 'hand-coins'}"></i>
                    </div>
                    <div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <h3 style="font-size:1.1rem; font-weight:700;">${d.name}</h3>
                        ${isFullyPaid ? '<span style="font-size:0.72rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:var(--radius-full); background:rgba(16, 185, 129, 0.15); color:var(--color-success);">Paid Off</span>' : ''}
                      </div>
                      <span style="font-size:0.78rem; color:${d.interest_rate > 0 ? 'var(--color-warning)' : 'var(--color-info)'}; font-weight:600;">
                        ${d.interest_rate > 0 ? `${d.interest_rate}% APR` : 'Personal Loan (0% Interest)'}
                      </span>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.4rem;">
                    <button class="icon-btn edit-debt-btn" data-id="${d.id}" style="width:32px; height:32px;" title="Edit Debt">
                      <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
                    </button>
                    <button class="icon-btn delete-debt-btn" data-id="${d.id}" style="width:32px; height:32px; color:var(--color-danger);" title="Delete Debt">
                      <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:0.3rem;">
                    <span>Remaining: <strong style="color:${isFullyPaid ? 'var(--color-success)' : 'var(--color-danger)'};">${formatCurrency(d.current_balance)}</strong></span>
                    <span>Original: <strong>${formatCurrency(d.total_amount)}</strong></span>
                  </div>

                  <div class="progress-bar-bg" style="height:10px;">
                    <div class="progress-bar-fill" style="width:${pct}%; background-color:var(--color-success);"></div>
                  </div>

                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem; flex-wrap:wrap; gap:0.25rem;">
                    <span>${pct}% paid off (${formatCurrency(paidDown)})</span>
                    <span>${d.minimum_payment > 0 ? `Target installment: ${formatCurrency(d.minimum_payment)}/mo` : 'No fixed installment'}</span>
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border-color);">
                  <button class="btn btn-outline btn-sm toggle-history-btn" data-id="${d.id}" style="font-size:0.8rem; padding:0.35rem 0.75rem;">
                    <i data-lucide="${isHistoryOpen ? 'chevron-up' : 'history'}"></i>
                    <span>${isHistoryOpen ? 'Hide History' : `Payment History (${payments.length})`}</span>
                  </button>

                  <button class="btn btn-primary btn-sm make-payment-btn" data-id="${d.id}" ${isFullyPaid ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                    <i data-lucide="dollar-sign"></i> Pay Installment
                  </button>
                </div>

                ${isHistoryOpen ? `
                  <div class="debt-history-section" style="background:var(--bg-tertiary, #f8f9fd); border-radius:var(--radius-md); padding:0.85rem; border:1px solid var(--border-color); margin-top:0.25rem;">
                    <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.35rem;">
                      <i data-lucide="list" style="width:14px; height:14px;"></i> Installment Payment Log
                    </div>

                    ${payments.length === 0 ? `
                      <div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:0.75rem 0;">
                        No installment payments logged yet. Click "Pay Installment" to record payments.
                      </div>
                    ` : `
                      <div style="display:flex; flex-direction:column; gap:0.45rem;">
                        ${payments.map(p => `
                          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-size:0.82rem;">
                            <div>
                              <div style="font-weight:600; color:var(--text-primary);">${p.date}</div>
                              <div style="font-size:0.75rem; color:var(--text-muted);">
                                ${p.account_name ? `From: ${p.account_name}` : 'Cash / Direct payment'}
                                ${p.note ? ` - ${p.note}` : ''}
                              </div>
                            </div>
                            <div style="font-weight:700; color:var(--color-success); font-size:0.9rem;">
                              -${formatCurrency(p.amount)}
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                ` : ''}
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
    document.getElementById('add-debt-btn')?.addEventListener('click', () => this.openDebtModal());

    container.addEventListener('click', async (e) => {
      const paymentBtn = e.target.closest('.make-payment-btn');
      if (paymentBtn && !paymentBtn.disabled) {
        const id = parseInt(paymentBtn.getAttribute('data-id'), 10);
        const debt = this.debts.find(d => d.id === id);
        if (debt) this.openPaymentModal(debt);
        return;
      }

      const historyBtn = e.target.closest('.toggle-history-btn');
      if (historyBtn) {
        const id = parseInt(historyBtn.getAttribute('data-id'), 10);
        this.expandedHistories[id] = !this.expandedHistories[id];
        this.render(container);
        return;
      }

      const editBtn = e.target.closest('.edit-debt-btn');
      if (editBtn) {
        const id = parseInt(editBtn.getAttribute('data-id'), 10);
        const debt = this.debts.find(d => d.id === id);
        if (debt) this.openDebtModal(debt);
        return;
      }

      const deleteBtn = e.target.closest('.delete-debt-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'), 10);
        if (confirm('Delete this debt record and all its payment history?')) {
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
        ${!isEdit ? `
          <div style="background:var(--bg-tertiary, #f8f9fd); padding:0.75rem 1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--border-color);">
            <div style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="zap" style="width:13px; height:13px; color:var(--color-primary);"></i> Quick Setup
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-outline" id="preset-borrowed-friend" style="font-size:0.8rem; padding:0.35rem 0.75rem; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:0.35rem;">
                <i data-lucide="hand-coins" style="width:14px; height:14px; color:var(--color-info);"></i> Borrowed from Friend (0% Interest)
              </button>
              <button type="button" class="btn btn-outline" id="preset-bank-loan" style="font-size:0.8rem; padding:0.35rem 0.75rem; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:0.35rem;">
                <i data-lucide="landmark" style="width:14px; height:14px; color:var(--color-warning);"></i> Bank Loan / Credit Card
              </button>
            </div>
          </div>
        ` : ''}

        <div class="form-group">
          <label>Debt / Loan Name</label>
          <input type="text" id="modal-debt-name" class="form-control" value="${debt ? debt.name : ''}" placeholder="e.g. Borrowed from John, Car Loan, Bank Loan" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Total Borrowed / Original Amount (€)</label>
            <input type="number" step="0.01" id="modal-debt-total" class="form-control" value="${debt ? debt.total_amount : ''}" placeholder="1000.00" required>
          </div>
          <div class="form-group">
            <label>Current Remaining Balance (€)</label>
            <input type="number" step="0.01" id="modal-debt-balance" class="form-control" value="${debt ? debt.current_balance : ''}" placeholder="1000.00" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Interest Rate (% APR)</label>
            <input type="number" step="0.1" id="modal-debt-rate" class="form-control" value="${debt ? debt.interest_rate : 0}" placeholder="0 for friend/family loans">
            <small style="color:var(--text-muted); font-size:0.75rem;">Leave 0 for personal loans / borrowed money</small>
          </div>
          <div class="form-group">
            <label>Target Monthly Installment (€)</label>
            <input type="number" step="0.01" id="modal-debt-min" class="form-control" value="${debt ? debt.minimum_payment : 0}" placeholder="Optional monthly target">
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
      title: isEdit ? `Edit Debt: ${debt.name}` : 'Add Debt / Borrowed Money Record',
      contentHTML,
      onSave: async () => {
        const name = document.getElementById('modal-debt-name').value;
        const total_amount = parseFloat(document.getElementById('modal-debt-total').value || 0);
        let current_balance_val = document.getElementById('modal-debt-balance').value;
        const current_balance = current_balance_val !== '' ? parseFloat(current_balance_val) : total_amount;
        const interest_rate = parseFloat(document.getElementById('modal-debt-rate').value || 0);
        const minimum_payment = parseFloat(document.getElementById('modal-debt-min').value || 0);
        const due_day = parseInt(document.getElementById('modal-debt-day').value || 1, 10);
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

    if (!isEdit) {
      document.getElementById('preset-borrowed-friend')?.addEventListener('click', () => {
        const nameEl = document.getElementById('modal-debt-name');
        const rateEl = document.getElementById('modal-debt-rate');
        const colorEl = document.getElementById('modal-debt-color');
        if (nameEl && !nameEl.value) nameEl.placeholder = 'e.g. Borrowed from Alex';
        if (rateEl) rateEl.value = '0';
        if (colorEl) colorEl.value = '#3B82F6';
      });

      document.getElementById('preset-bank-loan')?.addEventListener('click', () => {
        const nameEl = document.getElementById('modal-debt-name');
        const rateEl = document.getElementById('modal-debt-rate');
        const colorEl = document.getElementById('modal-debt-color');
        if (nameEl && !nameEl.value) nameEl.placeholder = 'e.g. Bank Personal Loan';
        if (rateEl && rateEl.value === '0') rateEl.value = '7.5';
        if (colorEl) colorEl.value = '#EF4444';
      });

      const totalInput = document.getElementById('modal-debt-total');
      const balanceInput = document.getElementById('modal-debt-balance');
      totalInput?.addEventListener('input', (e) => {
        if (!balanceInput.value || balanceInput.dataset.manual !== 'true') {
          balanceInput.value = e.target.value;
        }
      });
      balanceInput?.addEventListener('input', () => {
        balanceInput.dataset.manual = 'true';
      });
    }
  },

  openPaymentModal(debt) {
    const today = new Date().toISOString().split('T')[0];
    const defaultAmount = debt.minimum_payment > 0 ? Math.min(debt.minimum_payment, debt.current_balance) : debt.current_balance;

    const contentHTML = `
      <form id="debt-pay-form">
        <div style="background:var(--bg-tertiary, #f8f9fd); padding:0.85rem 1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--border-color);">
          <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.25rem;">${debt.name}</div>
          <div style="font-size:0.82rem; color:var(--text-muted); display:flex; gap:0.75rem; flex-wrap:wrap;">
            <span><strong>Total Borrowed:</strong> €${(debt.total_amount || 0).toFixed(2)}</span>
            <span><strong>Remaining Balance:</strong> <strong style="color:var(--color-danger);">€${(debt.current_balance || 0).toFixed(2)}</strong></span>
          </div>
        </div>

        <div class="form-group">
          <label>Installment Payment Amount (€)</label>
          <input type="number" step="0.01" id="pay-amount" class="form-control" value="${defaultAmount || ''}" max="${debt.current_balance}" placeholder="0.00" required autofocus>
          <small style="color:var(--text-muted); font-size:0.75rem;">Enter the amount of this installment payment</small>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Payment Date</label>
            <input type="date" id="pay-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label>Paid From Bank Account</label>
            <select id="pay-account" class="form-control">
              <option value="">Cash / Direct (Do not deduct from bank balance)</option>
              ${this.accounts.map(a => `<option value="${a.id}">${a.name} (€${a.balance.toFixed(2)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Payment Memo / Note</label>
          <input type="text" id="pay-note" class="form-control" placeholder="e.g. Installment 1 of 4, Cash repayment" value="Installment payment">
        </div>
      </form>
    `;

    Modal.open({
      title: `Record Installment Payment: ${debt.name}`,
      saveText: 'Confirm Payment',
      contentHTML,
      onSave: async () => {
        const amount = parseFloat(document.getElementById('pay-amount').value || 0);
        const account_id = document.getElementById('pay-account').value;
        const date = document.getElementById('pay-date').value;
        const note = document.getElementById('pay-note').value;

        if (!amount || amount <= 0) {
          Toast.show('Please enter a valid payment amount', 'warning');
          return false;
        }

        if (amount > debt.current_balance + 0.01) {
          if (!confirm(`Payment amount (€${amount.toFixed(2)}) is higher than remaining balance (€${debt.current_balance.toFixed(2)}). Continue?`)) {
            return false;
          }
        }

        await API.post(`/api/debts/${debt.id}/payment`, { amount, account_id, date, note });
        Toast.show(`Payment of €${amount.toFixed(2)} recorded on ${date}!`, 'success');

        this.expandedHistories[debt.id] = true;
        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  }
};

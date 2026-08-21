const DebtTrackerPage = {
  debts: [],
  accounts: [],
  categories: [],
  expandedHistories: {},
  currentFilter: 'all',

  getEffectiveDueDate(debt) {
    if (debt.next_payment_date) return debt.next_payment_date;
    if (debt.due_day && (debt.current_balance || 0) > 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const dueDay = Math.min(Math.max(parseInt(debt.due_day, 10) || 1, 1), 28);
      let target = new Date(currentYear, currentMonth, dueDay);
      const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const targetStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
      if (targetStr < todayStr) {
        target = new Date(currentYear, currentMonth + 1, dueDay);
      }
      return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    }
    return null;
  },

  getDaysDifference(targetDateStr) {
    if (!targetDateStr) return null;
    const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(tYear, tMonth - 1, tDay);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  },

  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Loading debt payoff tracker...</div>`;

    try {
      const [debtRes, acctRes, catRes] = await Promise.all([
        API.get('/api/debts'),
        API.get('/api/accounts'),
        API.get('/api/categories')
      ]);

      this.debts = debtRes || [];
      this.accounts = acctRes || [];
      this.categories = (catRes || []).filter(c => c.type === 'expense');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Sort debts based on date of arriving (earliest upcoming payment first, paid off at the end)
      this.debts.sort((a, b) => {
        const aPaid = (a.current_balance || 0) <= 0;
        const bPaid = (b.current_balance || 0) <= 0;

        if (aPaid && !bPaid) return 1;
        if (!aPaid && bPaid) return -1;

        const dateA = this.getEffectiveDueDate(a);
        const dateB = this.getEffectiveDueDate(b);

        if (dateA && dateB) {
          if (dateA !== dateB) return dateA < dateB ? -1 : 1;
        }

        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;

        return (b.current_balance || 0) - (a.current_balance || 0);
      });

      const totalOriginalDebt = this.debts.reduce((sum, d) => sum + (d.total_amount || 0), 0);
      const totalDebt = this.debts.reduce((sum, d) => sum + (d.current_balance || 0), 0);
      const totalPaidDown = Math.max(0, totalOriginalDebt - totalDebt);
      const overallPct = totalOriginalDebt > 0 ? Math.min(100, Math.round((totalPaidDown / totalOriginalDebt) * 100)) : 100;
      const totalMinPayments = this.debts.reduce((sum, d) => sum + (d.minimum_payment || 0), 0);

      // Identify debts arriving/due in next 10 days
      const debtsDueNext10Days = this.debts.filter(d => {
        if ((d.current_balance || 0) <= 0) return false;
        const dueDate = this.getEffectiveDueDate(d);
        if (!dueDate) return false;
        const diffDays = this.getDaysDifference(dueDate);
        return diffDays !== null && diffDays <= 10;
      });

      const neededNext10Days = debtsDueNext10Days.reduce((sum, d) => {
        const amt = (d.minimum_payment && d.minimum_payment > 0)
          ? Math.min(d.minimum_payment, d.current_balance)
          : d.current_balance;
        return sum + (amt || 0);
      }, 0);

      const activeDebtsCount = this.debts.filter(d => (d.current_balance || 0) > 0).length;
      const personalLoansCount = this.debts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) <= 0).length;
      const bankLoansCount = this.debts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) > 0).length;
      const paidLoansCount = this.debts.filter(d => (d.current_balance || 0) <= 0).length;

      // Filter displayed debts according to selected tab
      let displayedDebts = this.debts;
      let emptyMessage = "You currently have no borrowed money or loan accounts configured.";
      if (this.currentFilter === 'due10') {
        displayedDebts = debtsDueNext10Days;
        emptyMessage = "No debt payments due in the next 10 days! All obligations are clear.";
      } else if (this.currentFilter === 'personal') {
        displayedDebts = this.debts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) <= 0);
        emptyMessage = "No active personal (0% interest) loans configured.";
      } else if (this.currentFilter === 'bank') {
        displayedDebts = this.debts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) > 0);
        emptyMessage = "No active bank or interest-bearing loans configured.";
      } else if (this.currentFilter === 'paid') {
        displayedDebts = this.debts.filter(d => (d.current_balance || 0) <= 0);
        emptyMessage = "No paid-off debt accounts yet. Keep up the payoff momentum!";
      }

      container.innerHTML = `
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h2 style="font-size:1.35rem; font-weight:800; letter-spacing:-0.02em;">Debt Tracker & Cash Requirements</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Monitor total borrowed balances, short-term cash needs, and installment payoff schedules</p>
          </div>

          <button class="btn btn-primary" id="add-debt-btn">
            <i data-lucide="plus"></i> Add Debt / Borrowed Money
          </button>
        </div>

        <!-- 1. Hero Overview Summary Banner -->
        <div class="card" style="margin-bottom:1.5rem; padding:1.5rem; background:linear-gradient(135deg, var(--bg-card) 0%, var(--bg-tertiary, #f8f9fd) 100%); border:1px solid var(--border-color); border-radius:var(--radius-lg); box-shadow:var(--shadow-md);">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:1.5rem; align-items:stretch;">
            
            <!-- Left: Global Debt Balance & Repayment Progress -->
            <div style="display:flex; flex-direction:column; justify-content:space-between; gap:1.25rem;">
              <div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                  <div style="width:30px; height:30px; border-radius:var(--radius-md); background:rgba(239, 68, 68, 0.15); color:var(--color-danger); display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="credit-card" style="width:16px; height:16px;"></i>
                  </div>
                  <span style="font-size:0.85rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">Total Remaining Debt</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:0.75rem; flex-wrap:wrap;">
                  <h1 style="font-size:2.1rem; font-weight:800; color:var(--color-danger); line-height:1; margin:0;">${formatCurrency(totalDebt)}</h1>
                  <span style="font-size:0.85rem; color:var(--text-muted);">of ${formatCurrency(totalOriginalDebt)} original</span>
                </div>
              </div>

              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:600; margin-bottom:0.4rem;">
                  <span>Overall Repayment Progress</span>
                  <span style="color:var(--color-success); font-weight:700;">${overallPct}% Repaid (${formatCurrency(totalPaidDown)})</span>
                </div>
                <div class="progress-bar-bg" style="height:9px;">
                  <div class="progress-bar-fill" style="width:${overallPct}%; background-color:var(--color-success);"></div>
                </div>
              </div>

              <div style="display:flex; gap:1.5rem; flex-wrap:wrap; font-size:0.84rem; color:var(--text-secondary); padding-top:0.75rem; border-top:1px solid var(--border-color);">
                <div>
                  <span style="color:var(--text-muted);">Active Accounts:</span> <strong>${activeDebtsCount}</strong>
                </div>
                <div>
                  <span style="color:var(--text-muted);">Monthly Obligation:</span> <strong style="color:var(--color-warning);">${formatCurrency(totalMinPayments)}/mo</strong>
                </div>
              </div>
            </div>

            <!-- Right: Short-term Cash Needed (Next 10 Days) Highlight Box -->
            <div style="background:var(--bg-card); border:1.5px solid ${neededNext10Days > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)'}; border-radius:var(--radius-md); padding:1.35rem; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <span style="font-size:0.8rem; font-weight:700; color:${neededNext10Days > 0 ? 'var(--color-warning)' : 'var(--color-success)'}; text-transform:uppercase; letter-spacing:0.04em; display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="${neededNext10Days > 0 ? 'clock' : 'check-circle-2'}" style="width:15px; height:15px;"></i>
                    Cash Needed for Next 10 Days
                  </span>
                  <div style="font-size:1.9rem; font-weight:800; color:${neededNext10Days > 0 ? 'var(--color-warning)' : 'var(--color-success)'}; margin-top:0.35rem; line-height:1.1;">
                    ${formatCurrency(neededNext10Days)}
                  </div>
                </div>
                <div style="width:40px; height:40px; border-radius:var(--radius-full); background:${neededNext10Days > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color:${neededNext10Days > 0 ? 'var(--color-warning)' : 'var(--color-success)'}; display:flex; align-items:center; justify-content:center;">
                  <i data-lucide="${neededNext10Days > 0 ? 'alert-triangle' : 'check'}" style="width:20px; height:20px;"></i>
                </div>
              </div>

              <div style="font-size:0.84rem; color:var(--text-muted); line-height:1.45;">
                ${debtsDueNext10Days.length > 0 
                  ? `<strong>${debtsDueNext10Days.length} installment(s)</strong> require payment in the next 10 days.`
                  : `No upcoming debt payments required within the next 10 days.`}
              </div>

              ${debtsDueNext10Days.length > 0 ? `
                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-tertiary, #f8f9fd); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.8rem; border:1px solid var(--border-color);">
                  <span style="font-weight:600; color:var(--text-secondary);">Earliest Due Date:</span>
                  <span style="font-weight:700; color:var(--color-danger);">${this.getEffectiveDueDate(debtsDueNext10Days[0])}</span>
                </div>
              ` : `
                <div style="font-size:0.8rem; color:var(--color-success); font-weight:600; display:flex; align-items:center; gap:0.35rem;">
                  <i data-lucide="shield-check" style="width:14px; height:14px;"></i> All installment schedules are up to date!
                </div>
              `}
            </div>

          </div>
        </div>

        <!-- 2. Dedicated 10-Day Urgent Action Strip (if any due soon) -->
        ${debtsDueNext10Days.length > 0 ? `
          <div class="card" style="margin-bottom:1.5rem; padding:1.15rem 1.35rem; border:1px solid rgba(245, 158, 11, 0.35); background:rgba(245, 158, 11, 0.04); border-radius:var(--radius-md);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="width:28px; height:28px; border-radius:var(--radius-md); background:var(--color-warning); color:#fff; display:flex; align-items:center; justify-content:center;">
                  <i data-lucide="zap" style="width:16px; height:16px;"></i>
                </div>
                <div>
                  <h3 style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">Due in the Next 10 Days (${debtsDueNext10Days.length})</h3>
                  <span style="font-size:0.75rem; color:var(--text-muted);">Quick-pay installments due soon to avoid late fees or delays</span>
                </div>
              </div>
              <span style="font-size:0.8rem; font-weight:700; color:var(--color-warning); background:var(--bg-card); padding:0.25rem 0.65rem; border-radius:var(--radius-full); border:1px solid rgba(245, 158, 11, 0.3);">
                Total: ${formatCurrency(neededNext10Days)}
              </span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:0.75rem;">
              ${debtsDueNext10Days.map(d => {
                const dueDate = this.getEffectiveDueDate(d);
                const diffDays = this.getDaysDifference(dueDate);
                const defaultAmount = (d.minimum_payment && d.minimum_payment > 0) ? Math.min(d.minimum_payment, d.current_balance) : d.current_balance;

                let badgeBg = 'rgba(245, 158, 11, 0.15)';
                let badgeColor = 'var(--color-warning)';
                let badgeText = `Due in ${diffDays}d`;
                if (diffDays < 0) {
                  badgeBg = 'rgba(239, 68, 68, 0.15)';
                  badgeColor = 'var(--color-danger)';
                  badgeText = `${Math.abs(diffDays)}d overdue`;
                } else if (diffDays === 0) {
                  badgeBg = 'rgba(239, 68, 68, 0.15)';
                  badgeColor = 'var(--color-danger)';
                  badgeText = 'Due Today';
                }

                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); gap:0.5rem;">
                    <div style="min-width:0;">
                      <div style="font-weight:700; font-size:0.88rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${d.name}
                      </div>
                      <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; margin-top:0.15rem;">
                        <span style="padding:0.1rem 0.4rem; border-radius:var(--radius-sm); background:${badgeBg}; color:${badgeColor}; font-weight:700;">
                          ${badgeText}
                        </span>
                        <span style="color:var(--text-muted);">${dueDate}</span>
                      </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <div style="font-weight:800; color:var(--color-danger); font-size:0.9rem; white-space:nowrap;">
                        ${formatCurrency(defaultAmount)}
                      </div>
                      <button class="btn btn-primary btn-sm make-payment-btn" data-id="${d.id}" style="padding:0.25rem 0.6rem; font-size:0.75rem; white-space:nowrap;">
                        Pay
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 3. Quick Filter Tabs Navigation -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;" id="debt-filter-tabs">
            <button class="btn ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="all" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              All Debts (${this.debts.length})
            </button>
            <button class="btn ${this.currentFilter === 'due10' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="due10" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="clock" style="width:13px; height:13px;"></i> Due in 10 Days (${debtsDueNext10Days.length})
            </button>
            <button class="btn ${this.currentFilter === 'personal' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="personal" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="hand-coins" style="width:13px; height:13px;"></i> Personal Loans (${personalLoansCount})
            </button>
            <button class="btn ${this.currentFilter === 'bank' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="bank" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="landmark" style="width:13px; height:13px;"></i> Bank Loans (${bankLoansCount})
            </button>
            <button class="btn ${this.currentFilter === 'paid' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="paid" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="check" style="width:13px; height:13px;"></i> Paid Off (${paidLoansCount})
            </button>
          </div>

          <span style="font-size:0.8rem; color:var(--text-muted);">
            Showing <strong>${displayedDebts.length}</strong> of ${this.debts.length} records
          </span>
        </div>

        <!-- 4. Debts Cards Grid (Sorted by arrival date) -->
        <div class="grid-cols-2">
          ${displayedDebts.length === 0 ? `
            <div class="card" style="grid-column:1/-1; color:var(--text-muted); text-align:center; padding:3rem 1.5rem;">
              <div style="width:48px; height:48px; border-radius:var(--radius-full); background:var(--bg-tertiary, #f8f9fd); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.75rem;">
                <i data-lucide="check-circle-2" style="width:24px; height:24px; color:var(--color-success);"></i>
              </div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary);">${emptyMessage}</div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Use the filter tabs above or click "+ Add Debt" to add new records.</p>
            </div>
          ` : displayedDebts.map(d => {
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

                  ${!isFullyPaid ? (() => {
                    const effectiveDate = this.getEffectiveDueDate(d);
                    if (effectiveDate) {
                      const diffDays = this.getDaysDifference(effectiveDate);

                      let badgeColor = 'var(--text-muted)';
                      let dateText = effectiveDate;
                      if (diffDays < 0) {
                        badgeColor = 'var(--color-danger)';
                        dateText = `${effectiveDate} (${Math.abs(diffDays)}d overdue)`;
                      } else if (diffDays === 0) {
                        badgeColor = 'var(--color-danger)';
                        dateText = `${effectiveDate} (Due Today)`;
                      } else if (diffDays <= 3) {
                        badgeColor = 'var(--color-warning)';
                        dateText = `${effectiveDate} (Due in ${diffDays}d)`;
                      } else if (diffDays <= 10) {
                        badgeColor = 'var(--color-warning)';
                        dateText = `${effectiveDate} (Due in ${diffDays}d)`;
                      } else {
                        dateText = `${effectiveDate} (In ${diffDays}d)`;
                      }

                      return `
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.8rem; font-weight:600; color:${badgeColor}; margin-top:0.4rem;">
                          <i data-lucide="calendar-clock" style="width:14px; height:14px;"></i>
                          <span>Next Payment Date: <strong>${dateText}</strong></span>
                        </div>
                      `;
                    }
                    return `
                      <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem;">
                        <i data-lucide="calendar-clock" style="width:14px; height:14px;"></i>
                        <span>Next Payment Date: No scheduled date</span>
                      </div>
                    `;
                  })() : ''}
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
      const filterBtn = e.target.closest('.filter-tab-btn');
      if (filterBtn) {
        this.currentFilter = filterBtn.getAttribute('data-filter');
        this.render(container);
        return;
      }

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
            <label>Next Payment Date</label>
            <input type="date" id="modal-debt-next-date" class="form-control" value="${debt && debt.next_payment_date ? debt.next_payment_date : ''}">
            <small style="color:var(--text-muted); font-size:0.75rem;">Date of monthly payment</small>
          </div>
        </div>

        <div class="form-group">
          <label>Color Theme</label>
          <input type="color" id="modal-debt-color" class="form-control" value="${debt ? debt.color : '#EF4444'}" style="height:42px; padding:0.2rem;">
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
        const next_payment_date = document.getElementById('modal-debt-next-date').value || null;
        const color = document.getElementById('modal-debt-color').value;

        if (!name || total_amount <= 0) {
          Toast.show('Valid debt name and total amount are required', 'warning');
          return false;
        }

        if (isEdit) {
          await API.put(`/api/debts/${debt.id}`, { name, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color });
          Toast.show('Debt record updated!', 'success');
        } else {
          await API.post('/api/debts', { name, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color });
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
        const dateEl = document.getElementById('modal-debt-next-date');
        if (nameEl && !nameEl.value) nameEl.placeholder = 'e.g. Borrowed from Alex';
        if (rateEl) rateEl.value = '0';
        if (colorEl) colorEl.value = '#3B82F6';
        if (dateEl) dateEl.value = '';
      });

      document.getElementById('preset-bank-loan')?.addEventListener('click', () => {
        const nameEl = document.getElementById('modal-debt-name');
        const rateEl = document.getElementById('modal-debt-rate');
        const colorEl = document.getElementById('modal-debt-color');
        const dateEl = document.getElementById('modal-debt-next-date');
        if (nameEl && !nameEl.value) nameEl.placeholder = 'e.g. Bank Personal Loan';
        if (rateEl && rateEl.value === '0') rateEl.value = '7.5';
        if (colorEl) colorEl.value = '#EF4444';
        if (dateEl && !dateEl.value) {
          const now = new Date();
          const target = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          dateEl.value = target.toISOString().split('T')[0];
        }
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

        <div class="form-row">
          <div class="form-group">
            <label>Budget Expense Category</label>
            <select id="pay-category" class="form-control">
              ${this.categories.map(c => {
                const isDebtCat = c.name.toLowerCase().includes('debt') || c.name.toLowerCase().includes('loan');
                return `<option value="${c.id}" ${isDebtCat ? 'selected' : ''}>${c.name}</option>`;
              }).join('')}
            </select>
            <small style="color:var(--text-muted); font-size:0.75rem;">Impacts monthly category budget & notifications</small>
          </div>
          <div class="form-group">
            <label>Payment Memo / Note</label>
            <input type="text" id="pay-note" class="form-control" placeholder="e.g. Installment 1 of 4, Cash repayment" value="Installment payment">
          </div>
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
        const category_id = document.getElementById('pay-category')?.value;
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

        const res = await API.post(`/api/debts/${debt.id}/payment`, { amount, account_id, category_id, date, note });
        const nextDateMsg = res && res.next_payment_date ? ` Next payment due: ${res.next_payment_date}` : '';
        Toast.show(`Payment of €${amount.toFixed(2)} recorded!${nextDateMsg}`, 'success');

        if (window.updateNotificationBadges) {
          window.updateNotificationBadges();
        }

        this.expandedHistories[debt.id] = true;
        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  }
};

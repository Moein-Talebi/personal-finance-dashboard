const DebtTrackerPage = {
  debts: [],
  accounts: [],
  categories: [],
  expenseCategories: [],
  incomeCategories: [],
  expandedHistories: {},
  activeMode: 'borrowed', // 'borrowed' (I owe) or 'lent' (someone owes me)
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
    container.innerHTML = `<div class="loading-spinner">Loading debt & receivables tracker...</div>`;

    try {
      const [debtRes, acctRes, catRes] = await Promise.all([
        API.get('/api/debts'),
        API.get('/api/accounts'),
        API.get('/api/categories')
      ]);

      this.debts = debtRes || [];
      this.accounts = acctRes || [];
      this.categories = catRes || [];
      this.expenseCategories = this.categories.filter(c => c.type === 'expense');
      this.incomeCategories = this.categories.filter(c => c.type === 'income');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const isLentMode = this.activeMode === 'lent';

      // Separate debts into borrowed vs lent
      const borrowedDebts = this.debts.filter(d => (d.type || 'borrowed') === 'borrowed');
      const lentDebts = this.debts.filter(d => d.type === 'lent');

      // Debts for the current active mode
      const activeModeDebts = isLentMode ? lentDebts : borrowedDebts;

      // Sort current mode debts by arrival date
      activeModeDebts.sort((a, b) => {
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

      const totalOriginal = activeModeDebts.reduce((sum, d) => sum + (d.total_amount || 0), 0);
      const totalBalance = activeModeDebts.reduce((sum, d) => sum + (d.current_balance || 0), 0);
      const totalRepaid = Math.max(0, totalOriginal - totalBalance);
      const overallPct = totalOriginal > 0 ? Math.min(100, Math.round((totalRepaid / totalOriginal) * 100)) : 100;
      const totalMonthlyMin = activeModeDebts.reduce((sum, d) => sum + (d.minimum_payment || 0), 0);

      // Debts due in the next 10 days
      const debtsDueNext10Days = activeModeDebts.filter(d => {
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

      const activeCount = activeModeDebts.filter(d => (d.current_balance || 0) > 0).length;
      const personalCount = activeModeDebts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) <= 0).length;
      const bankCount = activeModeDebts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) > 0).length;
      const paidCount = activeModeDebts.filter(d => (d.current_balance || 0) <= 0).length;

      // Filter displayed debts according to selected tab
      let displayedDebts = activeModeDebts;
      let emptyMessage = isLentMode 
        ? "You currently have no lent money or receivable records configured."
        : "You currently have no borrowed money or loan accounts configured.";

      if (this.currentFilter === 'due10') {
        displayedDebts = debtsDueNext10Days;
        emptyMessage = isLentMode
          ? "No incoming repayments expected in the next 10 days."
          : "No debt payments due in the next 10 days! All obligations are clear.";
      } else if (this.currentFilter === 'personal') {
        displayedDebts = activeModeDebts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) <= 0);
        emptyMessage = isLentMode 
          ? "No active 0% personal loans lent to others."
          : "No active personal (0% interest) loans configured.";
      } else if (this.currentFilter === 'bank') {
        displayedDebts = activeModeDebts.filter(d => (d.current_balance || 0) > 0 && (d.interest_rate || 0) > 0);
        emptyMessage = isLentMode
          ? "No active loans with interest/fees configured."
          : "No active bank or interest-bearing loans configured.";
      } else if (this.currentFilter === 'paid') {
        displayedDebts = activeModeDebts.filter(d => (d.current_balance || 0) <= 0);
        emptyMessage = isLentMode
          ? "No fully collected / completed loans yet."
          : "No paid-off debt accounts yet. Keep up the payoff momentum!";
      }

      container.innerHTML = `
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h2 style="font-size:1.35rem; font-weight:800; letter-spacing:-0.02em;">
              ${isLentMode ? 'Money Lent & Receivables Tracker' : 'Debt Tracker & Borrowed Money'}
            </h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">
              ${isLentMode 
                ? 'Track money you lent to others, expected incoming repayments, and collection history'
                : 'Monitor total borrowed balances, short-term cash needs, and installment payoff schedules'}
            </p>
          </div>

          <button class="btn btn-primary" id="add-debt-btn">
            <i data-lucide="plus"></i> ${isLentMode ? 'Add Lent Money / Receivable' : 'Add Debt / Borrowed Money'}
          </button>
        </div>

        <!-- Mode Toggle: Money I Owe vs Money Owed to Me -->
        <div style="display:flex; justify-content:center; margin-bottom:1.5rem;">
          <div style="background:var(--bg-tertiary, #f1f5f9); padding:0.35rem; border-radius:var(--radius-full); display:inline-flex; gap:0.4rem; border:1px solid var(--border-color);">
            <button class="btn ${!isLentMode ? 'btn-primary' : 'btn-outline'} btn-sm debt-mode-btn" data-mode="borrowed" style="border-radius:var(--radius-full); padding:0.45rem 1.25rem; font-weight:700; font-size:0.88rem; display:inline-flex; align-items:center; gap:0.45rem;">
              <i data-lucide="arrow-down-left" style="width:16px; height:16px;"></i> Money I Owe (Debts) (${borrowedDebts.length})
            </button>
            <button class="btn ${isLentMode ? 'btn-primary' : 'btn-outline'} btn-sm debt-mode-btn" data-mode="lent" style="border-radius:var(--radius-full); padding:0.45rem 1.25rem; font-weight:700; font-size:0.88rem; display:inline-flex; align-items:center; gap:0.45rem;">
              <i data-lucide="arrow-up-right" style="width:16px; height:16px;"></i> Money Owed to Me (${lentDebts.length})
            </button>
          </div>
        </div>

        <!-- 1. Hero Overview Summary Banner -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem; margin-bottom:1.5rem;">
          
          <!-- Card 1: Global Balance & Repayment Progress -->
          <div class="card" style="padding:1.35rem; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; border:1px solid var(--border-color); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <div style="width:32px; height:32px; border-radius:var(--radius-md); background:${isLentMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color:${isLentMode ? 'var(--color-success)' : 'var(--color-danger)'}; display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="${isLentMode ? 'hand-coins' : 'credit-card'}" style="width:16px; height:16px;"></i>
                  </div>
                  <span style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">
                    ${isLentMode ? 'Total Money Owed to You' : 'Total Remaining Debt'}
                  </span>
                </div>
              </div>
              <div style="display:flex; align-items:baseline; gap:0.6rem; flex-wrap:wrap;">
                <h1 style="font-size:1.9rem; font-weight:800; color:${isLentMode ? 'var(--color-success)' : 'var(--color-danger)'}; line-height:1; margin:0;">${formatCurrency(totalBalance)}</h1>
                <span style="font-size:0.8rem; color:var(--text-muted);">of ${formatCurrency(totalOriginal)}</span>
              </div>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem;">
                <span>${isLentMode ? 'Collection Progress' : 'Repayment Progress'}</span>
                <span style="color:var(--color-success); font-weight:700;">${overallPct}% (${formatCurrency(totalRepaid)})</span>
              </div>
              <div class="progress-bar-bg" style="height:8px;">
                <div class="progress-bar-fill" style="width:${overallPct}%; background-color:var(--color-success);"></div>
              </div>
            </div>

            <div style="font-size:0.8rem; color:var(--text-muted); padding-top:0.5rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between;">
              <span>${isLentMode ? 'Active Debtors:' : 'Active Accounts:'} <strong>${activeCount}</strong></span>
              <span>Paid Off: <strong>${paidCount}</strong></span>
            </div>
          </div>

          <!-- Card 2: Monthly Minimum Payments / Obligations Due This Month -->
          <div class="card" style="padding:1.35rem; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; border:1px solid var(--border-color); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <div style="width:32px; height:32px; border-radius:var(--radius-md); background:rgba(245, 158, 11, 0.15); color:var(--color-warning); display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="calendar" style="width:16px; height:16px;"></i>
                  </div>
                  <span style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">
                    ${isLentMode ? 'Expected Monthly Inflow' : 'Monthly Minimum Payments'}
                  </span>
                </div>
                <span style="font-size:0.75rem; font-weight:700; color:var(--color-warning); background:rgba(245, 158, 11, 0.12); padding:0.15rem 0.5rem; border-radius:var(--radius-full);">
                  This Month
                </span>
              </div>
              <div style="display:flex; align-items:baseline; gap:0.6rem; flex-wrap:wrap;">
                <h1 style="font-size:1.9rem; font-weight:800; color:var(--color-warning); line-height:1; margin:0;">${formatCurrency(totalMonthlyMin)}</h1>
                <span style="font-size:0.8rem; color:var(--text-muted);">/ month</span>
              </div>
            </div>

            <div style="font-size:0.83rem; color:var(--text-secondary); line-height:1.4;">
              ${isLentMode 
                ? `Total expected incoming installments from debtors for this month.`
                : `Total fixed minimum installments required to stay on schedule this month.`}
            </div>

            <div style="font-size:0.8rem; color:var(--text-muted); padding-top:0.5rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
              <span>Accounts with schedule:</span>
              <strong style="color:var(--text-primary);">${activeModeDebts.filter(d => (d.current_balance || 0) > 0 && ((d.minimum_payment || 0) > 0 || (d.due_day && d.due_day > 1))).length}</strong>
            </div>
          </div>

          <!-- Card 3: 10-Day Cash Window Box -->
          <div class="card" style="padding:1.35rem; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; border:1.5px solid ${neededNext10Days > 0 ? (isLentMode ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)') : 'var(--border-color)'}; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); background:${neededNext10Days > 0 ? (isLentMode ? 'rgba(16, 185, 129, 0.02)' : 'rgba(245, 158, 11, 0.02)') : 'var(--bg-card)'};">
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <div style="width:32px; height:32px; border-radius:var(--radius-md); background:${neededNext10Days > 0 ? (isLentMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)') : 'rgba(59, 130, 246, 0.15)'}; color:${neededNext10Days > 0 ? (isLentMode ? 'var(--color-success)' : 'var(--color-warning)') : 'var(--color-info)'}; display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="${neededNext10Days > 0 ? 'clock' : 'check-circle-2'}" style="width:16px; height:16px;"></i>
                  </div>
                  <span style="font-size:0.82rem; font-weight:700; color:${neededNext10Days > 0 ? (isLentMode ? 'var(--color-success)' : 'var(--color-warning)') : 'var(--color-info)'}; text-transform:uppercase; letter-spacing:0.04em;">
                    ${isLentMode ? 'Expected (Next 10 Days)' : 'Needed (Next 10 Days)'}
                  </span>
                </div>
                ${neededNext10Days > 0 ? `
                  <span style="font-size:0.75rem; font-weight:700; color:${isLentMode ? 'var(--color-success)' : 'var(--color-warning)'}; background:${isLentMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)'}; padding:0.15rem 0.5rem; border-radius:var(--radius-full);">
                    Due Soon
                  </span>
                ` : ''}
              </div>
              <div style="display:flex; align-items:baseline; gap:0.6rem; flex-wrap:wrap;">
                <h1 style="font-size:1.9rem; font-weight:800; color:${neededNext10Days > 0 ? (isLentMode ? 'var(--color-success)' : 'var(--color-warning)') : 'var(--color-info)'}; line-height:1; margin:0;">${formatCurrency(neededNext10Days)}</h1>
                <span style="font-size:0.8rem; color:var(--text-muted);">${debtsDueNext10Days.length} installment(s)</span>
              </div>
            </div>

            <div style="font-size:0.83rem; color:var(--text-muted); line-height:1.4;">
              ${debtsDueNext10Days.length > 0 
                ? (isLentMode ? `Expected repayments arriving in the next 10 days.` : `Required payments due in the next 10 days.`)
                : (isLentMode ? `No incoming repayments in next 10 days.` : `No debt payments required in next 10 days.`)}
            </div>

            <div style="font-size:0.8rem; padding-top:0.5rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-secondary);">Earliest:</span>
              ${debtsDueNext10Days.length > 0 ? `
                <strong style="color:${isLentMode ? 'var(--color-success)' : 'var(--color-danger)'};">${this.getEffectiveDueDate(debtsDueNext10Days[0])}</strong>
              ` : `
                <span style="color:var(--color-success); font-weight:600; display:flex; align-items:center; gap:0.25rem;">
                  <i data-lucide="shield-check" style="width:13px; height:13px;"></i> Clear
                </span>
              `}
            </div>
          </div>

        </div>

        <!-- 2. Dedicated 10-Day Urgent Action Strip (if any due soon) -->
        ${debtsDueNext10Days.length > 0 ? `
          <div class="card" style="margin-bottom:1.5rem; padding:1.15rem 1.35rem; border:1px solid ${isLentMode ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}; background:${isLentMode ? 'rgba(16, 185, 129, 0.04)' : 'rgba(245, 158, 11, 0.04)'}; border-radius:var(--radius-md);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="width:28px; height:28px; border-radius:var(--radius-md); background:${isLentMode ? 'var(--color-success)' : 'var(--color-warning)'}; color:#fff; display:flex; align-items:center; justify-content:center;">
                  <i data-lucide="${isLentMode ? 'arrow-down-left' : 'zap'}" style="width:16px; height:16px;"></i>
                </div>
                <div>
                  <h3 style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">
                    ${isLentMode ? `Expected Incoming in Next 10 Days (${debtsDueNext10Days.length})` : `Due in the Next 10 Days (${debtsDueNext10Days.length})`}
                  </h3>
                  <span style="font-size:0.75rem; color:var(--text-muted);">
                    ${isLentMode ? 'Quick-receive repayments and deposit into your account balance' : 'Quick-pay installments due soon to avoid late fees or delays'}
                  </span>
                </div>
              </div>
              <span style="font-size:0.8rem; font-weight:700; color:${isLentMode ? 'var(--color-success)' : 'var(--color-warning)'}; background:var(--bg-card); padding:0.25rem 0.65rem; border-radius:var(--radius-full); border:1px solid ${isLentMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'};">
                Total: ${formatCurrency(neededNext10Days)}
              </span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:0.75rem;">
              ${debtsDueNext10Days.map(d => {
                const dueDate = this.getEffectiveDueDate(d);
                const diffDays = this.getDaysDifference(dueDate);
                const defaultAmount = (d.minimum_payment && d.minimum_payment > 0) ? Math.min(d.minimum_payment, d.current_balance) : d.current_balance;

                let badgeBg = isLentMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)';
                let badgeColor = isLentMode ? 'var(--color-success)' : 'var(--color-warning)';
                let badgeText = `In ${diffDays}d`;
                if (diffDays < 0) {
                  badgeBg = 'rgba(239, 68, 68, 0.15)';
                  badgeColor = 'var(--color-danger)';
                  badgeText = `${Math.abs(diffDays)}d overdue`;
                } else if (diffDays === 0) {
                  badgeBg = isLentMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)';
                  badgeColor = isLentMode ? 'var(--color-success)' : 'var(--color-danger)';
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
                      <div style="font-weight:800; color:${isLentMode ? 'var(--color-success)' : 'var(--color-danger)'}; font-size:0.9rem; white-space:nowrap;">
                        ${formatCurrency(defaultAmount)}
                      </div>
                      <button class="btn ${isLentMode ? 'btn-success' : 'btn-primary'} btn-sm make-payment-btn" data-id="${d.id}" style="padding:0.25rem 0.6rem; font-size:0.75rem; white-space:nowrap; ${isLentMode ? 'background:var(--color-success); border-color:var(--color-success); color:#fff;' : ''}">
                        ${isLentMode ? 'Receive' : 'Pay'}
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
              ${isLentMode ? 'All Receivables' : 'All Debts'} (${activeModeDebts.length})
            </button>
            <button class="btn ${this.currentFilter === 'due10' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="due10" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="clock" style="width:13px; height:13px;"></i> ${isLentMode ? 'Incoming in 10 Days' : 'Due in 10 Days'} (${debtsDueNext10Days.length})
            </button>
            <button class="btn ${this.currentFilter === 'personal' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="personal" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="hand-coins" style="width:13px; height:13px;"></i> ${isLentMode ? '0% Personal Loans' : 'Personal Loans'} (${personalCount})
            </button>
            <button class="btn ${this.currentFilter === 'bank' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="bank" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="landmark" style="width:13px; height:13px;"></i> ${isLentMode ? 'With Interest/Fees' : 'Bank Loans'} (${bankCount})
            </button>
            <button class="btn ${this.currentFilter === 'paid' ? 'btn-primary' : 'btn-outline'} btn-sm filter-tab-btn" data-filter="paid" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              <i data-lucide="check" style="width:13px; height:13px;"></i> ${isLentMode ? 'Fully Collected' : 'Paid Off'} (${paidCount})
            </button>
          </div>

          <span style="font-size:0.8rem; color:var(--text-muted);">
            Showing <strong>${displayedDebts.length}</strong> of ${activeModeDebts.length} records
          </span>
        </div>

        <!-- 4. Cards Grid (Sorted by arrival date) -->
        <div class="grid-cols-2">
          ${displayedDebts.length === 0 ? `
            <div class="card" style="grid-column:1/-1; color:var(--text-muted); text-align:center; padding:3rem 1.5rem;">
              <div style="width:48px; height:48px; border-radius:var(--radius-full); background:var(--bg-tertiary, #f8f9fd); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.75rem;">
                <i data-lucide="check-circle-2" style="width:24px; height:24px; color:var(--color-success);"></i>
              </div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary);">${emptyMessage}</div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Use the button above to add a new record.</p>
            </div>
          ` : displayedDebts.map(d => {
            const isLentItem = d.type === 'lent';
            const paidDown = Math.max(0, (d.total_amount || 0) - (d.current_balance || 0));
            const pct = d.total_amount > 0 ? Math.min(100, Math.round((paidDown / d.total_amount) * 100)) : 0;
            const payments = d.payments || [];
            const isHistoryOpen = !!this.expandedHistories[d.id];
            const isFullyPaid = d.current_balance <= 0;

            return `
              <div class="card" style="display:flex; flex-direction:column; gap:1.25rem; border:1px solid ${isFullyPaid ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:0.85rem;">
                    <div style="width:44px; height:44px; border-radius:var(--radius-md); background:${d.color || (isLentItem ? '#10B981' : '#EF4444')}22; color:${d.color || (isLentItem ? '#10B981' : '#EF4444')}; display:flex; align-items:center; justify-content:center;">
                      <i data-lucide="${d.interest_rate > 0 ? 'landmark' : 'hand-coins'}"></i>
                    </div>
                    <div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <h3 style="font-size:1.1rem; font-weight:700;">${d.name}</h3>
                        ${isFullyPaid ? `<span style="font-size:0.72rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:var(--radius-full); background:rgba(16, 185, 129, 0.15); color:var(--color-success);">${isLentItem ? 'Fully Collected' : 'Paid Off'}</span>` : ''}
                      </div>
                      <span style="font-size:0.78rem; color:${d.interest_rate > 0 ? 'var(--color-warning)' : 'var(--color-info)'}; font-weight:600;">
                        ${d.interest_rate > 0 ? `${d.interest_rate}% APR` : (isLentItem ? 'Personal Loan to Friend (0%)' : 'Personal Loan (0% Interest)')}
                      </span>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.4rem;">
                    <button class="icon-btn edit-debt-btn" data-id="${d.id}" style="width:32px; height:32px;" title="Edit Record">
                      <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
                    </button>
                    <button class="icon-btn delete-debt-btn" data-id="${d.id}" style="width:32px; height:32px; color:var(--color-danger);" title="Delete Record">
                      <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:0.3rem;">
                    <span>${isLentItem ? 'Remaining Owed:' : 'Remaining:'} <strong style="color:${isFullyPaid ? 'var(--color-success)' : (isLentItem ? 'var(--color-primary)' : 'var(--color-danger)')};">${formatCurrency(d.current_balance)}</strong></span>
                    <span>${isLentItem ? 'Total Lent:' : 'Original:'} <strong>${formatCurrency(d.total_amount)}</strong></span>
                  </div>

                  <div class="progress-bar-bg" style="height:10px;">
                    <div class="progress-bar-fill" style="width:${pct}%; background-color:var(--color-success);"></div>
                  </div>

                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem; flex-wrap:wrap; gap:0.25rem;">
                    <span>${pct}% ${isLentItem ? 'collected' : 'paid off'} (${formatCurrency(paidDown)})</span>
                    <span>${d.minimum_payment > 0 ? `${isLentItem ? 'Expected installment' : 'Target installment'}: ${formatCurrency(d.minimum_payment)}/mo` : 'Flexible repayment'}</span>
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
                        badgeColor = isLentItem ? 'var(--color-success)' : 'var(--color-danger)';
                        dateText = `${effectiveDate} (Due Today)`;
                      } else if (diffDays <= 3) {
                        badgeColor = isLentItem ? 'var(--color-success)' : 'var(--color-warning)';
                        dateText = `${effectiveDate} (Due in ${diffDays}d)`;
                      } else if (diffDays <= 10) {
                        badgeColor = isLentItem ? 'var(--color-success)' : 'var(--color-warning)';
                        dateText = `${effectiveDate} (Due in ${diffDays}d)`;
                      } else {
                        dateText = `${effectiveDate} (In ${diffDays}d)`;
                      }

                      return `
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.8rem; font-weight:600; color:${badgeColor}; margin-top:0.4rem;">
                          <i data-lucide="calendar-clock" style="width:14px; height:14px;"></i>
                          <span>${isLentItem ? 'Next Expected Repayment:' : 'Next Payment Date:'} <strong>${dateText}</strong></span>
                        </div>
                      `;
                    }
                    return `
                      <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem;">
                        <i data-lucide="calendar-clock" style="width:14px; height:14px;"></i>
                        <span>${isLentItem ? 'Next Expected Repayment:' : 'Next Payment Date:'} No scheduled date</span>
                      </div>
                    `;
                  })() : ''}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border-color);">
                  <button class="btn btn-outline btn-sm toggle-history-btn" data-id="${d.id}" style="font-size:0.8rem; padding:0.35rem 0.75rem;">
                    <i data-lucide="${isHistoryOpen ? 'chevron-up' : 'history'}"></i>
                    <span>${isHistoryOpen ? 'Hide History' : `Payment History (${payments.length})`}</span>
                  </button>

                  <button class="btn ${isLentItem ? 'btn-success' : 'btn-primary'} btn-sm make-payment-btn" data-id="${d.id}" ${isFullyPaid ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : (isLentItem ? 'style="background:var(--color-success); border-color:var(--color-success); color:#fff;"' : '')}>
                    <i data-lucide="${isLentItem ? 'arrow-down-left' : 'dollar-sign'}"></i> ${isLentItem ? 'Receive Repayment' : 'Pay Installment'}
                  </button>
                </div>

                ${isHistoryOpen ? `
                  <div class="debt-history-section" style="background:var(--bg-tertiary, #f8f9fd); border-radius:var(--radius-md); padding:0.85rem; border:1px solid var(--border-color); margin-top:0.25rem;">
                    <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.35rem;">
                      <i data-lucide="list" style="width:14px; height:14px;"></i> ${isLentItem ? 'Repayment Collection Log' : 'Installment Payment Log'}
                    </div>

                    ${payments.length === 0 ? `
                      <div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:0.75rem 0;">
                        No payments logged yet. Click "${isLentItem ? 'Receive Repayment' : 'Pay Installment'}" to record transactions.
                      </div>
                    ` : `
                      <div style="display:flex; flex-direction:column; gap:0.45rem;">
                        ${payments.map(p => `
                          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-size:0.82rem;">
                            <div>
                              <div style="font-weight:600; color:var(--text-primary);">${p.date}</div>
                              <div style="font-size:0.75rem; color:var(--text-muted);">
                                ${p.account_name ? `${isLentItem ? 'Deposited to:' : 'From:'} ${p.account_name}` : 'Cash / Direct'}
                                ${p.note ? ` - ${p.note}` : ''}
                              </div>
                            </div>
                            <div style="font-weight:700; color:var(--color-success); font-size:0.9rem;">
                              ${isLentItem ? '+' : '-'}${formatCurrency(p.amount)}
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
    container.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('#add-debt-btn');
      if (addBtn) {
        this.openDebtModal(null, this.activeMode);
        return;
      }

      const modeBtn = e.target.closest('.debt-mode-btn');
      if (modeBtn) {
        this.activeMode = modeBtn.getAttribute('data-mode');
        this.currentFilter = 'all';
        this.render(container);
        return;
      }

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
        if (debt) this.openDebtModal(debt, debt.type || 'borrowed');
        return;
      }

      const deleteBtn = e.target.closest('.delete-debt-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'), 10);
        if (confirm('Delete this record and all its payment history?')) {
          await API.delete(`/api/debts/${id}`);
          Toast.show('Record deleted', 'success');
          this.render(container);
        }
      }
    });
  },

  openDebtModal(debt = null, defaultType = null) {
    const isEdit = !!debt;
    const initialType = debt ? (debt.type || 'borrowed') : (defaultType || this.activeMode || 'borrowed');
    const isInitialLent = initialType === 'lent';

    const contentHTML = `
      <form id="debt-form">
        <!-- Type Switcher (I Borrowed vs I Lent) -->
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label style="font-weight:700; margin-bottom:0.5rem; display:block;">Record Classification</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
            <label id="type-borrowed-label" style="display:flex; align-items:center; gap:0.6rem; padding:0.75rem 0.9rem; border:2px solid ${!isInitialLent ? 'var(--color-danger)' : 'var(--border-color)'}; background:${!isInitialLent ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)'}; border-radius:var(--radius-md); cursor:pointer; transition:all 0.2s ease;">
              <input type="radio" name="modal-debt-type" value="borrowed" ${!isInitialLent ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
              <div>
                <div style="font-weight:700; font-size:0.88rem; color:var(--color-danger);">Money I Borrowed</div>
                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:0.1rem;">I owe money to someone / bank</small>
              </div>
            </label>
            <label id="type-lent-label" style="display:flex; align-items:center; gap:0.6rem; padding:0.75rem 0.9rem; border:2px solid ${isInitialLent ? 'var(--color-success)' : 'var(--border-color)'}; background:${isInitialLent ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)'}; border-radius:var(--radius-md); cursor:pointer; transition:all 0.2s ease;">
              <input type="radio" name="modal-debt-type" value="lent" ${isInitialLent ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
              <div>
                <div style="font-weight:700; font-size:0.88rem; color:var(--color-success);">Money I Lent</div>
                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:0.1rem;">Someone owes money to me</small>
              </div>
            </label>
          </div>
        </div>

        ${!isEdit ? `
          <div style="background:var(--bg-tertiary, #f8f9fd); padding:0.75rem 1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--border-color);">
            <div style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="zap" style="width:13px; height:13px; color:var(--color-primary);"></i> Quick Preset
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;" id="presets-container">
              <button type="button" class="btn btn-outline" id="preset-friend" style="font-size:0.8rem; padding:0.35rem 0.75rem; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:0.35rem;">
                <i data-lucide="hand-coins" style="width:14px; height:14px; color:var(--color-info);"></i> Personal / Friend Loan (0%)
              </button>
              <button type="button" class="btn btn-outline" id="preset-commercial" style="font-size:0.8rem; padding:0.35rem 0.75rem; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:0.35rem;">
                <i data-lucide="landmark" style="width:14px; height:14px; color:var(--color-warning);"></i> Bank Loan / Installment
              </button>
            </div>
          </div>
        ` : ''}

        <div class="form-group">
          <label id="lbl-debt-name">${isInitialLent ? 'Borrower / Debtor Name' : 'Debt / Loan Name'}</label>
          <input type="text" id="modal-debt-name" class="form-control" value="${debt ? debt.name : ''}" placeholder="${isInitialLent ? 'e.g. Lent to Sarah, Alex Loan' : 'e.g. Borrowed from John, Car Loan'}" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label id="lbl-debt-total">${isInitialLent ? 'Total Amount Lent (€)' : 'Total Borrowed / Original Amount (€)'}</label>
            <input type="number" step="0.01" id="modal-debt-total" class="form-control" value="${debt ? debt.total_amount : ''}" placeholder="1000.00" required>
          </div>
          <div class="form-group">
            <label id="lbl-debt-balance">${isInitialLent ? 'Current Remaining Owed to You (€)' : 'Current Remaining Balance (€)'}</label>
            <input type="number" step="0.01" id="modal-debt-balance" class="form-control" value="${debt ? debt.current_balance : ''}" placeholder="1000.00" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Interest Rate (% APR)</label>
            <input type="number" step="0.1" id="modal-debt-rate" class="form-control" value="${debt ? debt.interest_rate : 0}" placeholder="0 for personal loans">
            <small style="color:var(--text-muted); font-size:0.75rem;">Leave 0 for 0% personal loans</small>
          </div>
          <div class="form-group">
            <label id="lbl-debt-min">${isInitialLent ? 'Expected Monthly Repayment (€)' : 'Target Monthly Installment (€)'}</label>
            <input type="number" step="0.01" id="modal-debt-min" class="form-control" value="${debt ? debt.minimum_payment : 0}" placeholder="Optional monthly target">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Due Day of Month (1-31)</label>
            <input type="number" min="1" max="31" id="modal-debt-day" class="form-control" value="${debt ? debt.due_day : 1}">
          </div>
          <div class="form-group">
            <label id="lbl-debt-date">${isInitialLent ? 'Next Expected Repayment Date' : 'Next Payment Date'}</label>
            <input type="date" id="modal-debt-next-date" class="form-control" value="${debt && debt.next_payment_date ? debt.next_payment_date : ''}">
            <small style="color:var(--text-muted); font-size:0.75rem;">Date of upcoming payment</small>
          </div>
        </div>

        <div class="form-group">
          <label>Color Theme</label>
          <input type="color" id="modal-debt-color" class="form-control" value="${debt ? debt.color : (isInitialLent ? '#10B981' : '#EF4444')}" style="height:42px; padding:0.2rem;">
        </div>
      </form>
    `;

    Modal.open({
      title: isEdit 
        ? `Edit Record: ${debt.name}` 
        : (isInitialLent ? 'Add Lent Money Record' : 'Add Debt / Borrowed Money Record'),
      contentHTML,
      onSave: async () => {
        const typeEl = document.querySelector('input[name="modal-debt-type"]:checked');
        const type = typeEl ? typeEl.value : (initialType || 'borrowed');
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
          Toast.show('Valid name and total amount are required', 'warning');
          return false;
        }

        if (isEdit) {
          await API.put(`/api/debts/${debt.id}`, { name, type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color });
          Toast.show('Record updated!', 'success');
        } else {
          await API.post('/api/debts', { name, type, total_amount, current_balance, interest_rate, minimum_payment, due_day, next_payment_date, color });
          Toast.show('Record created!', 'success');
        }

        this.activeMode = type;
        this.currentFilter = 'all';
        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });

    // Dynamic type switching in modal
    const typeRadios = document.querySelectorAll('input[name="modal-debt-type"]');
    typeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const isLent = e.target.value === 'lent';
        const borrowedLbl = document.getElementById('type-borrowed-label');
        const lentLbl = document.getElementById('type-lent-label');
        const nameLbl = document.getElementById('lbl-debt-name');
        const totalLbl = document.getElementById('lbl-debt-total');
        const balanceLbl = document.getElementById('lbl-debt-balance');
        const minLbl = document.getElementById('lbl-debt-min');
        const dateLbl = document.getElementById('lbl-debt-date');
        const nameInput = document.getElementById('modal-debt-name');
        const colorInput = document.getElementById('modal-debt-color');
        const modalTitle = document.querySelector('.modal-header h3');

        if (borrowedLbl && lentLbl) {
          if (isLent) {
            lentLbl.style.border = '2px solid var(--color-success)';
            lentLbl.style.background = 'rgba(16, 185, 129, 0.08)';
            borrowedLbl.style.border = '2px solid var(--border-color)';
            borrowedLbl.style.background = 'var(--bg-card)';
          } else {
            borrowedLbl.style.border = '2px solid var(--color-danger)';
            borrowedLbl.style.background = 'rgba(239, 68, 68, 0.08)';
            lentLbl.style.border = '2px solid var(--border-color)';
            lentLbl.style.background = 'var(--bg-card)';
          }
        }

        if (modalTitle && !isEdit) {
          modalTitle.textContent = isLent ? 'Add Lent Money Record' : 'Add Debt / Borrowed Money Record';
        }

        if (nameLbl) nameLbl.textContent = isLent ? 'Borrower / Debtor Name' : 'Debt / Loan Name';
        if (totalLbl) totalLbl.textContent = isLent ? 'Total Amount Lent (€)' : 'Total Borrowed / Original Amount (€)';
        if (balanceLbl) balanceLbl.textContent = isLent ? 'Current Remaining Owed to You (€)' : 'Current Remaining Balance (€)';
        if (minLbl) minLbl.textContent = isLent ? 'Expected Monthly Repayment (€)' : 'Target Monthly Installment (€)';
        if (dateLbl) dateLbl.textContent = isLent ? 'Next Expected Repayment Date' : 'Next Payment Date';
        if (nameInput && !nameInput.value) {
          nameInput.placeholder = isLent ? 'e.g. Lent to Sarah, Alex Loan' : 'e.g. Borrowed from John, Car Loan';
        }
        if (colorInput && !isEdit) {
          colorInput.value = isLent ? '#10B981' : '#EF4444';
        }
      });
    });

    if (!isEdit) {
      document.getElementById('preset-friend')?.addEventListener('click', () => {
        const nameEl = document.getElementById('modal-debt-name');
        const rateEl = document.getElementById('modal-debt-rate');
        const colorEl = document.getElementById('modal-debt-color');
        const dateEl = document.getElementById('modal-debt-next-date');
        const typeEl = document.querySelector('input[name="modal-debt-type"]:checked');
        const isLent = typeEl && typeEl.value === 'lent';

        if (nameEl && !nameEl.value) nameEl.placeholder = isLent ? 'e.g. Lent to Sarah' : 'e.g. Borrowed from Alex';
        if (rateEl) rateEl.value = '0';
        if (colorEl) colorEl.value = isLent ? '#10B981' : '#3B82F6';
        if (dateEl) dateEl.value = '';
      });

      document.getElementById('preset-commercial')?.addEventListener('click', () => {
        const nameEl = document.getElementById('modal-debt-name');
        const rateEl = document.getElementById('modal-debt-rate');
        const colorEl = document.getElementById('modal-debt-color');
        const dateEl = document.getElementById('modal-debt-next-date');
        const typeEl = document.querySelector('input[name="modal-debt-type"]:checked');
        const isLent = typeEl && typeEl.value === 'lent';

        if (nameEl && !nameEl.value) nameEl.placeholder = isLent ? 'e.g. Client Project Advance' : 'e.g. Bank Personal Loan';
        if (rateEl && rateEl.value === '0') rateEl.value = '5.0';
        if (colorEl) colorEl.value = isLent ? '#10B981' : '#EF4444';
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
    const isLent = debt.type === 'lent';
    const today = new Date().toISOString().split('T')[0];
    const defaultAmount = debt.minimum_payment > 0 ? Math.min(debt.minimum_payment, debt.current_balance) : debt.current_balance;

    const contentHTML = `
      <form id="debt-pay-form">
        <div style="background:var(--bg-tertiary, #f8f9fd); padding:0.85rem 1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--border-color);">
          <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.25rem;">${debt.name}</div>
          <div style="font-size:0.82rem; color:var(--text-muted); display:flex; gap:0.75rem; flex-wrap:wrap;">
            <span><strong>${isLent ? 'Total Lent:' : 'Total Borrowed:'}</strong> €${(debt.total_amount || 0).toFixed(2)}</span>
            <span><strong>${isLent ? 'Remaining Owed to You:' : 'Remaining Balance:'}</strong> <strong style="color:${isLent ? 'var(--color-success)' : 'var(--color-danger)'};">€${(debt.current_balance || 0).toFixed(2)}</strong></span>
          </div>
        </div>

        <div class="form-group">
          <label>${isLent ? 'Repayment Amount Received (€)' : 'Installment Payment Amount (€)'}</label>
          <input type="number" step="0.01" id="pay-amount" class="form-control" value="${defaultAmount || ''}" max="${debt.current_balance}" placeholder="0.00" required autofocus>
          <small style="color:var(--text-muted); font-size:0.75rem;">${isLent ? 'Enter the amount received from the debtor' : 'Enter the amount of this installment payment'}</small>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Payment Date</label>
            <input type="date" id="pay-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label>${isLent ? 'Deposit Into Bank Account' : 'Paid From Bank Account'}</label>
            <select id="pay-account" class="form-control">
              <option value="">Cash / Direct (${isLent ? 'Do not deposit to bank' : 'Do not deduct from bank'})</option>
              ${this.accounts.map(a => `<option value="${a.id}">${a.name} (€${a.balance.toFixed(2)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>${isLent ? 'Income Category' : 'Budget Expense Category'}</label>
            <select id="pay-category" class="form-control">
              ${isLent 
                ? (this.incomeCategories.length > 0 ? this.incomeCategories : [{ id: 1, name: 'Other Income' }]).map(c => `<option value="${c.id}">${c.name}</option>`).join('')
                : this.expenseCategories.map(c => {
                    const isDebtCat = c.name.toLowerCase().includes('debt') || c.name.toLowerCase().includes('loan');
                    return `<option value="${c.id}" ${isDebtCat ? 'selected' : ''}>${c.name}</option>`;
                  }).join('')
              }
            </select>
          </div>
          <div class="form-group">
            <label>Payment Memo / Note</label>
            <input type="text" id="pay-note" class="form-control" placeholder="${isLent ? 'e.g. Cash repayment, Partial payment' : 'e.g. Installment 1 of 4, Cash repayment'}" value="${isLent ? 'Repayment received' : 'Installment payment'}">
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: isLent ? `Record Repayment Received: ${debt.name}` : `Record Installment Payment: ${debt.name}`,
      saveText: isLent ? 'Confirm & Deposit Repayment' : 'Confirm Payment',
      contentHTML,
      onSave: async () => {
        const amount = parseFloat(document.getElementById('pay-amount').value || 0);
        const account_id = document.getElementById('pay-account').value;
        const category_id = document.getElementById('pay-category')?.value;
        const date = document.getElementById('pay-date').value;
        const note = document.getElementById('pay-note').value;

        if (!amount || amount <= 0) {
          Toast.show('Please enter a valid amount', 'warning');
          return false;
        }

        if (amount > debt.current_balance + 0.01) {
          if (!confirm(`Payment amount (€${amount.toFixed(2)}) is higher than remaining balance (€${debt.current_balance.toFixed(2)}). Continue?`)) {
            return false;
          }
        }

        const res = await API.post(`/api/debts/${debt.id}/payment`, { amount, account_id, category_id, date, note });
        const nextDateMsg = res && res.next_payment_date ? ` Next date: ${res.next_payment_date}` : '';
        Toast.show(`${isLent ? 'Repayment' : 'Payment'} of €${amount.toFixed(2)} recorded!${nextDateMsg}`, 'success');

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


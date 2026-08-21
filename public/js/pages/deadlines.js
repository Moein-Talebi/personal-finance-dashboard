const DeadlinesPage = {
  deadlines: [],
  recurringItems: [],
  debts: [],

  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Loading financial deadlines...</div>`;

    try {
      const [dlRes, recRes, debtRes] = await Promise.all([
        API.get('/api/deadlines'),
        API.get('/api/recurring'),
        API.get('/api/debts')
      ]);

      this.deadlines = dlRes;
      this.recurringItems = recRes.filter(r => r.active && r.type === 'expense');
      this.debts = debtRes.filter(d => (d.current_balance || 0) > 0);

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const todayStr = new Date().toISOString().split('T')[0];

      // Build auto-detected items list from recurring and debts
      const autoDetected = [];

      // 1. Upcoming active recurring items
      this.recurringItems.forEach(r => {
        if (r.next_due) {
          autoDetected.push({
            type: 'recurring',
            title: r.name,
            source: r.frequency === 'monthly' ? 'Monthly Subscription / Bill' : `${r.frequency} Bill`,
            due_date: r.next_due,
            amount: r.amount,
            category: 'bill',
            targetHash: '#recurring',
            icon: 'repeat'
          });
        }
      });

      // 2. Upcoming debt installments based on due_day
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      this.debts.forEach(d => {
        if (d.current_balance > 0) {
          let debtDueStr = d.next_payment_date;
          if (!debtDueStr) {
            const dueDay = Math.min(Math.max(parseInt(d.due_day, 10) || 1, 1), 28);
            let targetDate = new Date(currentYear, currentMonth, dueDay);
            if (targetDate.toISOString().split('T')[0] < todayStr) {
              targetDate = new Date(currentYear, currentMonth + 1, dueDay);
            }
            debtDueStr = targetDate.toISOString().split('T')[0];
          }

          autoDetected.push({
            type: 'debt',
            title: `${d.name} Installment`,
            source: 'Debt Repayment',
            due_date: debtDueStr,
            amount: d.minimum_payment > 0 ? d.minimum_payment : d.current_balance,
            category: 'debt',
            targetHash: '#debts',
            icon: 'credit-card'
          });
        }
      });

      // Sort autoDetected by due_date ascending
      autoDetected.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:700;">Financial Deadline Manager</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Track upcoming bill due dates, debt installments, and target deadlines</p>
          </div>

          <button class="btn btn-primary" id="add-deadline-btn">
            <i data-lucide="plus"></i> Add Custom Deadline
          </button>
        </div>

        <!-- Cross-section: Auto-Detected Upcoming Payments from Subscriptions & Debts -->
        <div class="card" style="margin-bottom:1.5rem; padding:1.25rem; border:1px solid var(--border-color); background:var(--bg-card);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <div style="width:32px; height:32px; border-radius:var(--radius-md); background:rgba(59, 130, 246, 0.12); color:var(--color-info); display:flex; align-items:center; justify-content:center;">
                <i data-lucide="sparkles" style="width:16px; height:16px;"></i>
              </div>
              <div>
                <h3 style="font-size:1.05rem; font-weight:700;">Auto-Detected Upcoming Payments</h3>
                <span style="font-size:0.75rem; color:var(--text-muted);">Synced live from your active Subscriptions, Recurring Bills & Debts</span>
              </div>
            </div>
            <span style="font-size:0.75rem; font-weight:700; padding:0.2rem 0.6rem; border-radius:var(--radius-full); background:var(--bg-tertiary); color:var(--text-secondary);">
              ${autoDetected.length} items detected
            </span>
          </div>

          ${autoDetected.length === 0 ? `
            <div style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:1.25rem 0;">
              No active recurring bills or debts scheduled.
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:0.85rem;">
              ${autoDetected.map((item, idx) => {
                const isOverdue = item.due_date < todayStr;
                const isDueToday = item.due_date === todayStr;

                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md); gap:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.65rem; min-width:0;">
                      <div style="width:34px; height:34px; border-radius:var(--radius-full); background:var(--bg-tertiary); color:var(--color-primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i data-lucide="${item.icon}" style="width:16px; height:16px;"></i>
                      </div>
                      <div style="min-width:0; overflow:hidden;">
                        <div style="font-weight:700; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.title}">${item.title}</div>
                        <div style="font-size:0.72rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem;">
                          <span>Due: <strong>${item.due_date}</strong></span>
                          <span>•</span>
                          <a href="${item.targetHash}" style="color:var(--color-primary); text-decoration:none; font-weight:600;">${item.source}</a>
                        </div>
                      </div>
                    </div>

                    <div style="text-align:right; flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:0.3rem;">
                      <div style="font-weight:800; font-size:0.92rem; color:var(--color-danger);">-${formatCurrency(item.amount)}</div>
                      <button class="btn btn-outline btn-sm pin-deadline-btn" 
                        data-title="${item.title}" 
                        data-amount="${item.amount}" 
                        data-date="${item.due_date}" 
                        data-cat="${item.category}" 
                        data-desc="Auto-synced from ${item.source}"
                        style="font-size:0.72rem; padding:0.2rem 0.5rem; gap:0.25rem;">
                        <i data-lucide="bookmark-plus" style="width:12px; height:12px;"></i> Pin
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div style="margin-bottom:0.75rem;">
          <h3 style="font-size:1.1rem; font-weight:700;">Pinned & Custom Deadlines</h3>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${this.deadlines.length === 0 ? `
            <div class="card" style="color:var(--text-muted); text-align:center; padding:2.5rem 1.5rem;">
              <div style="width:44px; height:44px; border-radius:var(--radius-full); background:var(--bg-tertiary); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.75rem;">
                <i data-lucide="calendar-check" style="width:22px; height:22px; color:var(--color-primary);"></i>
              </div>
              <div style="font-weight:700; font-size:1rem; color:var(--text-primary);">No Custom Deadlines</div>
              <p style="font-size:0.82rem; color:var(--text-muted); margin-top:0.25rem;">Pin auto-detected payments from above or click "Add Custom Deadline" to track tax returns, bills, and obligations.</p>
            </div>
          ` : this.deadlines.map(d => {
            const isCompleted = d.status === 'completed';
            const isOverdue = d.due_date < todayStr && !isCompleted;
            
            let statusBadge = `<span style="font-size:0.75rem; font-weight:600; padding:0.2rem 0.5rem; border-radius:var(--radius-full); background:rgba(59, 130, 246, 0.15); color:var(--color-info);">Upcoming</span>`;
            if (isCompleted) {
              statusBadge = `<span style="font-size:0.75rem; font-weight:600; padding:0.2rem 0.5rem; border-radius:var(--radius-full); background:rgba(16, 185, 129, 0.15); color:var(--color-success);">Completed</span>`;
            } else if (isOverdue) {
              statusBadge = `<span style="font-size:0.75rem; font-weight:600; padding:0.2rem 0.5rem; border-radius:var(--radius-full); background:rgba(239, 68, 68, 0.15); color:var(--color-danger);">Overdue</span>`;
            }

            let priorityColor = 'var(--text-muted)';
            if (d.priority === 'high') priorityColor = 'var(--color-danger)';
            if (d.priority === 'medium') priorityColor = 'var(--color-warning)';

            return `
              <div class="card" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; opacity:${isCompleted ? 0.6 : 1};">
                <div style="display:flex; align-items:center; gap:1rem;">
                  <div style="width:42px; height:42px; border-radius:var(--radius-md); background:${isOverdue ? 'rgba(239,68,68,0.15)' : 'var(--bg-tertiary)'}; color:${isOverdue ? 'var(--color-danger)' : 'var(--color-primary)'}; display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="calendar-clock"></i>
                  </div>

                  <div>
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                      <h3 style="font-size:1.05rem; font-weight:700;">${d.title}</h3>
                      ${statusBadge}
                      <span style="font-size:0.72rem; font-weight:600; text-transform:uppercase; color:${priorityColor};">${d.priority} Priority</span>
                    </div>
                    <p style="font-size:0.82rem; color:var(--text-muted); margin-top:0.2rem;">${d.description || 'No notes'} • Due: <strong>${d.due_date}</strong></p>
                  </div>
                </div>

                <div style="display:flex; align-items:center; gap:1.25rem;">
                  ${d.amount > 0 ? `<div style="font-weight:700; font-size:1.1rem; color:var(--text-primary);">${formatCurrency(d.amount)}</div>` : ''}

                  <div style="display:flex; gap:0.5rem;">
                    ${!isCompleted ? `
                      <button class="btn btn-secondary btn-sm complete-dl-btn" data-id="${d.id}">
                        <i data-lucide="check"></i> Done
                      </button>
                    ` : ''}
                    <button class="icon-btn delete-dl-btn" data-id="${d.id}" style="width:32px; height:32px; color:var(--color-danger);" title="Delete">
                      <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      if (window.lucide) lucide.createIcons();
      this.attachEvents(container);

    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load deadlines: ${err.message}</div>`;
    }
  },

  attachEvents(container) {
    document.getElementById('add-deadline-btn')?.addEventListener('click', () => this.openDeadlineModal());

    container.addEventListener('click', async (e) => {
      const pinBtn = e.target.closest('.pin-deadline-btn');
      if (pinBtn) {
        const title = pinBtn.getAttribute('data-title');
        const amount = pinBtn.getAttribute('data-amount');
        const due_date = pinBtn.getAttribute('data-date');
        const category = pinBtn.getAttribute('data-cat');
        const description = pinBtn.getAttribute('data-desc');
        this.openDeadlineModal({ title, amount, due_date, category, description });
        return;
      }

      const completeBtn = e.target.closest('.complete-dl-btn');
      if (completeBtn) {
        const id = parseInt(completeBtn.getAttribute('data-id'), 10);
        await API.put(`/api/deadlines/${id}/complete`);
        Toast.show('Deadline marked as completed!', 'success');
        this.render(container);
        return;
      }

      const deleteBtn = e.target.closest('.delete-dl-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'), 10);
        if (confirm('Delete this deadline entry?')) {
          await API.delete(`/api/deadlines/${id}`);
          Toast.show('Deadline deleted', 'success');
          this.render(container);
        }
      }
    });
  },

  openDeadlineModal(prefill = {}) {
    const today = new Date().toISOString().split('T')[0];

    const contentHTML = `
      <form id="deadline-form">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="modal-dl-title" class="form-control" value="${prefill.title || ''}" placeholder="e.g. Tax return payment, Insurance renewal" required>
        </div>

        <div class="form-group">
          <label>Description</label>
          <input type="text" id="modal-dl-desc" class="form-control" value="${prefill.description || ''}" placeholder="Optional details">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Due Date</label>
            <input type="date" id="modal-dl-date" class="form-control" value="${prefill.due_date || today}" required>
          </div>
          <div class="form-group">
            <label>Amount (€)</label>
            <input type="number" step="0.01" id="modal-dl-amount" class="form-control" value="${prefill.amount || ''}" placeholder="0.00">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select id="modal-dl-cat" class="form-control">
              <option value="bill" ${prefill.category === 'bill' ? 'selected' : ''}>Bill</option>
              <option value="debt" ${prefill.category === 'debt' ? 'selected' : ''}>Debt Payment</option>
              <option value="goal" ${prefill.category === 'goal' ? 'selected' : ''}>Goal Target</option>
              <option value="tax" ${prefill.category === 'tax' ? 'selected' : ''}>Tax / Official</option>
              <option value="custom" ${prefill.category === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </div>
          <div class="form-group">
            <label>Priority</label>
            <select id="modal-dl-priority" class="form-control">
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: prefill.title ? `Pin Deadline: ${prefill.title}` : 'Add Financial Deadline',
      contentHTML,
      onSave: async () => {
        const title = document.getElementById('modal-dl-title').value;
        const description = document.getElementById('modal-dl-desc').value;
        const due_date = document.getElementById('modal-dl-date').value;
        const amount = parseFloat(document.getElementById('modal-dl-amount').value || 0);
        const category = document.getElementById('modal-dl-cat').value;
        const priority = document.getElementById('modal-dl-priority').value;

        if (!title || !due_date) {
          Toast.show('Title and due date are required', 'warning');
          return false;
        }

        await API.post('/api/deadlines', { title, description, due_date, amount, category, priority });
        Toast.show('Deadline added!', 'success');

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  }
};


const DeadlinesPage = {
  deadlines: [],

  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Loading financial deadlines...</div>`;

    try {
      this.deadlines = await API.get('/api/deadlines');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const todayStr = new Date().toISOString().split('T')[0];

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:700;">Financial Deadline Manager</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Track upcoming bill due dates, debt payments, and target deadlines</p>
          </div>

          <button class="btn btn-primary" id="add-deadline-btn">
            <i data-lucide="plus"></i> Add Deadline
          </button>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${this.deadlines.length === 0 ? '<div class="card" style="color:var(--text-muted);">No deadlines recorded</div>' : this.deadlines.map(d => {
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
                    <p style="font-size:0.82rem; color:var(--text-muted); margin-top:0.2rem;">${d.description || 'No notes'} â€¢ Due: <strong>${d.due_date}</strong></p>
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
                    <button class="icon-btn delete-dl-btn" data-id="${d.id}" style="width:32px; height:32px; color:var(--color-danger);">
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
    document.getElementById('add-deadline-btn').addEventListener('click', () => this.openDeadlineModal());

    container.addEventListener('click', async (e) => {
      const completeBtn = e.target.closest('.complete-dl-btn');
      if (completeBtn) {
        const id = parseInt(completeBtn.getAttribute('data-id'));
        await API.put(`/api/deadlines/${id}/complete`);
        Toast.show('Deadline marked as completed!', 'success');
        this.render(container);
      }

      const deleteBtn = e.target.closest('.delete-dl-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'));
        if (confirm('Delete this deadline entry?')) {
          await API.delete(`/api/deadlines/${id}`);
          Toast.show('Deadline deleted', 'success');
          this.render(container);
        }
      }
    });
  },

  openDeadlineModal() {
    const today = new Date().toISOString().split('T')[0];

    const contentHTML = `
      <form id="deadline-form">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="modal-dl-title" class="form-control" placeholder="e.g. Tax return payment" required>
        </div>

        <div class="form-group">
          <label>Description</label>
          <input type="text" id="modal-dl-desc" class="form-control" placeholder="Optional details">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Due Date</label>
            <input type="date" id="modal-dl-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label>Amount ($)</label>
            <input type="number" step="0.01" id="modal-dl-amount" class="form-control" placeholder="0.00">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select id="modal-dl-cat" class="form-control">
              <option value="bill">Bill</option>
              <option value="debt">Debt Payment</option>
              <option value="goal">Goal Target</option>
              <option value="tax">Tax / Official</option>
              <option value="custom">Custom</option>
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
      title: 'Add Financial Deadline',
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

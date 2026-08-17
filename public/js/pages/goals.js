const GoalsPage = {
  goals: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:200px;">
        <div style="color:var(--color-primary); font-weight:700;">Loading savings workspace...</div>
      </div>`;

    try {
      this.goals = await API.get('/api/goals');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Summary statistics
      const totalGoals = this.goals.length;
      const finishedGoals = this.goals.filter(g => g.current_amount >= g.target_amount).length;
      const inProgressGoals = this.goals.filter(g => g.current_amount > 0 && g.current_amount < g.target_amount).length;
      const notStartedGoals = this.goals.filter(g => g.current_amount === 0).length;

      container.innerHTML = `
        <div class="flex-between m-bottom-8">
          <div>
            <h1 style="font-size:1.75rem; font-weight:800; letter-spacing:-0.02em;">Savings Goals</h1>
            <p style="color:var(--text-secondary); font-size:0.95rem; font-weight:600; margin-top:4px;">
              Create and manage long-term savings plans
            </p>
          </div>

          <button class="btn btn-primary" id="add-goal-btn">
            <i data-lucide="plus"></i> <span>Create Savings Goal</span>
          </button>
        </div>

        <!-- Summary Statistics Row -->
        <div class="card m-bottom-8" style="padding: 1.25rem;">
          <div class="chip-grid">
            <div class="chip-tag active">Total Goals: ${totalGoals}</div>
            <div class="chip-tag">In progress: ${inProgressGoals}</div>
            <div class="chip-tag">Not started: ${notStartedGoals}</div>
            <div class="chip-tag">Finished: ${finishedGoals}</div>
          </div>
        </div>

        <!-- Goals Card Grid -->
        <div class="goals-grid m-bottom-8">
          ${this.goals.length === 0 ? `
            <div class="card" style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
              <h3>No goals created yet</h3>
              <p style="font-size:0.9rem; margin-top:0.5rem;">Click the button in the top right to get started.</p>
            </div>
          ` : this.goals.map(g => {
            const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
            const remaining = Math.max(0, g.target_amount - g.current_amount);
            
            let statusClass = 'warning';
            let statusText = 'in progress';
            if (pct >= 100) {
              statusClass = 'success';
              statusText = 'finished';
            } else if (pct === 0) {
              statusClass = 'danger';
              statusText = 'not started';
            }

            return `
              <div class="goal-card card">
                <div class="goal-header">
                  <div style="display:flex; align-items:center; gap:0.85rem;">
                    <div style="width:40px; height:40px; border-radius:var(--radius-full); background:${g.color}18; color:${g.color}; display:flex; align-items:center; justify-content:center;">
                      <i data-lucide="target" style="width:20px; height:20px;"></i>
                    </div>
                    <div>
                      <h3 class="goal-title">${g.name}</h3>
                      <span class="goal-deadline">Deadline: ${g.deadline}</span>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.45rem;">
                    <button class="edit-goal-btn icon-btn" data-id="${g.id}" style="width:32px; height:32px;">
                      <i data-lucide="edit-2" style="width:12px; height:12px;"></i>
                    </button>
                    <button class="delete-goal-btn icon-btn" data-id="${g.id}" style="width:32px; height:32px; color:var(--color-danger);">
                      <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                    </button>
                  </div>
                </div>

                <div class="goal-amount-row">
                  <div>
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">Saved so far</span>
                    <div class="goal-amount-current">${formatCurrency(g.current_amount)}</div>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">Target Goal</span>
                    <div class="goal-amount-target">${formatCurrency(g.target_amount)}</div>
                  </div>
                </div>

                <div style="margin-top:1rem;">
                  <div class="progress-bar-bg" style="height:10px;">
                    <div class="progress-bar-fill" style="width:${pct}%; background-color:${g.color || 'var(--color-primary)'};"></div>
                  </div>
                  <div class="flex-between" style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.5rem; font-weight:600;">
                    <span class="status-pill ${statusClass}">${statusText} (${pct}%)</span>
                    <span>${remaining === 0 ? 'ðŸŽ‰ Completed!' : formatCurrency(remaining) + ' left'}</span>
                  </div>
                </div>

                <div style="display:flex; justify-content:flex-end; margin-top:1.25rem; border-top:1px solid var(--border-color); padding-top:1rem;">
                  <button class="btn btn-secondary btn-sm contribute-btn" data-id="${g.id}">
                    <i data-lucide="plus-circle"></i> Add savings
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Savings growth Wave Chart -->
        <div class="card">
          <div class="flex-between m-bottom-6">
            <h3 style="font-size:1.15rem; font-weight:800;">Savings overview</h3>
            <span class="status-pill info">Monthly progress growth</span>
          </div>
          <div style="height:250px;">
            <canvas id="goals-growth-chart"></canvas>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
      this.renderGrowthChart();
      this.attachEvents(container);

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="color:var(--color-danger); padding:2rem; text-align:center;">
          <h3 style="margin-bottom:0.5rem;">Failed to load goals workspace</h3>
          <p style="font-size:0.9rem;">${err.message}</p>
        </div>`;
    }
  },

  renderGrowthChart() {
    const ctx = document.getElementById('goals-growth-chart')?.getContext('2d');
    if (!ctx) return;

    const getThemeColor = (variable) => getComputedStyle(document.body).getPropertyValue(variable).trim();

    // Create wave purple gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(118, 100, 228, 0.35)');
    gradient.addColorStop(1, 'rgba(118, 100, 228, 0.00)');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        datasets: [{
          label: 'Total Saved Growth',
          data: [4200, 5100, 5800, 6900, 8100, 9500, 11000],
          borderColor: '#7664E4',
          borderWidth: 3.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.45,
          pointRadius: 4,
          pointBackgroundColor: '#7664E4'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: getThemeColor('--text-secondary'), font: { family: 'Outfit', weight: '600' } },
            grid: { display: false }
          },
          y: {
            ticks: { color: getThemeColor('--text-secondary'), font: { family: 'Outfit' } },
            grid: { color: getThemeColor('--border-color') }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  },

  attachEvents(container) {
    document.getElementById('add-goal-btn').addEventListener('click', () => this.openGoalModal());

    container.addEventListener('click', async (e) => {
      const contribBtn = e.target.closest('.contribute-btn');
      if (contribBtn) {
        const id = parseInt(contribBtn.getAttribute('data-id'));
        const goal = this.goals.find(g => g.id === id);
        if (goal) this.openContributionModal(goal);
      }

      const editBtn = e.target.closest('.edit-goal-btn');
      if (editBtn) {
        const id = parseInt(editBtn.getAttribute('data-id'));
        const goal = this.goals.find(g => g.id === id);
        if (goal) this.openGoalModal(goal);
      }

      const deleteBtn = e.target.closest('.delete-goal-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'));
        if (confirm('Delete this goal card?')) {
          await API.delete(`/api/goals/${id}`);
          Toast.show('Savings goal card deleted', 'success');
          this.render(container);
        }
      }
    });
  },

  openGoalModal(goal = null) {
    const isEdit = !!goal;
    const defaultDate = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

    const contentHTML = `
      <form id="goal-form">
        <div class="form-group">
          <label>Goal Target Name</label>
          <input type="text" id="modal-goal-name" class="form-control" value="${goal ? goal.name : ''}" placeholder="e.g. MacBook Pro, Japan Vacation" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Target Budget ($)</label>
            <input type="number" step="50" id="modal-goal-target" class="form-control" value="${goal ? goal.target_amount : 1000}" required>
          </div>
          <div class="form-group">
            <label>Current Funds ($)</label>
            <input type="number" step="50" id="modal-goal-current" class="form-control" value="${goal ? goal.current_amount : 0}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Target Deadline</label>
            <input type="date" id="modal-goal-date" class="form-control" value="${goal ? goal.deadline : defaultDate}" required>
          </div>
          <div class="form-group">
            <label>Color Theme</label>
            <input type="color" id="modal-goal-color" class="form-control" value="${goal ? goal.color : '#7664E4'}" style="height:48px; padding:0.2rem; cursor:pointer;">
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: isEdit ? `Edit Goal: ${goal.name}` : 'Create Savings Goal',
      contentHTML,
      onSave: async () => {
        const name = document.getElementById('modal-goal-name').value;
        const target_amount = parseFloat(document.getElementById('modal-goal-target').value || 0);
        const current_amount = parseFloat(document.getElementById('modal-goal-current').value || 0);
        const deadline = document.getElementById('modal-goal-date').value;
        const color = document.getElementById('modal-goal-color').value;

        if (!name || target_amount <= 0) {
          Toast.show('Valid goal target name and amount are required', 'warning');
          return false;
        }

        if (isEdit) {
          await API.put(`/api/goals/${goal.id}`, { name, target_amount, current_amount, deadline, color });
          Toast.show('Savings goal details updated!', 'success');
        } else {
          await API.post('/api/goals', { name, target_amount, current_amount, deadline, color });
          Toast.show('Savings goal card created!', 'success');
        }

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  },

  openContributionModal(goal) {
    const contentHTML = `
      <form id="contrib-form">
        <div class="form-group">
          <label>Contribution Amount ($)</label>
          <input type="number" step="10" id="contrib-amount" class="form-control" placeholder="250.00" style="font-size:1.5rem; font-weight:800; text-align:center;" required>
        </div>
      </form>
    `;

    Modal.open({
      title: `Contribute to ${goal.name}`,
      contentHTML,
      onSave: async () => {
        const contrib = parseFloat(document.getElementById('contrib-amount').value || 0);
        if (!contrib || contrib <= 0) {
          Toast.show('Please enter a positive contribution amount', 'warning');
          return false;
        }

        await API.put(`/api/goals/${goal.id}`, { contribution: contrib });
        Toast.show(`Contributed $${contrib.toFixed(2)} to ${goal.name}!`, 'success');
        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  }
};

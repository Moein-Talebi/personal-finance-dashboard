const BudgetPage = {
  categories: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:200px;">
        <div style="color:var(--color-primary); font-weight:700;">Loading budgets...</div>
      </div>`;

    try {
      const [catRes, txRes] = await Promise.all([
        API.get('/api/categories'),
        API.get('/api/transactions')
      ]);

      this.categories = catRes;
      const expenseCategories = this.categories.filter(c => c.type === 'expense');

      const currentMonth = new Date().toISOString().substring(0, 7);
      const currentMonthTxs = txRes.filter(t => t.type === 'expense' && t.date.startsWith(currentMonth));

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Aggregates
      const totalAllocated = expenseCategories.reduce((sum, c) => sum + (c.budget_limit || 0), 0);
      const totalSpent = currentMonthTxs.reduce((sum, t) => sum + t.amount, 0);
      const totalPct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
      const totalRemaining = totalAllocated - totalSpent;

      container.innerHTML = `
        <div class="flex-between m-bottom-8">
          <div>
            <h1 style="font-size:1.75rem; font-weight:800; letter-spacing:-0.02em;">Category Budgets</h1>
            <p style="color:var(--text-secondary); font-size:0.95rem; font-weight:600; margin-top:4px;">
              Manage and track monthly expenditure limits
            </p>
          </div>

          <button class="btn btn-primary" id="add-category-btn">
            <i data-lucide="plus"></i> <span>Add Budget Category</span>
          </button>
        </div>

        <!-- Budget Gauge & Overview Summary Row -->
        <div class="grid-cols-2 m-bottom-8">
          <div class="card">
            <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:1.25rem;">Overall Budget Progress</h3>
            <div style="display:flex; align-items:center; justify-content:space-around; flex-wrap:wrap; gap:1.5rem;">
              <div class="donut-chart-container" style="width: 140px; height: 140px;">
                <canvas id="budget-overall-gauge"></canvas>
                <div class="donut-center-label">
                  <span class="donut-center-value">${totalPct}%</span>
                  <span class="donut-center-sub">Spent</span>
                </div>
              </div>

              <div>
                <div style="margin-bottom:0.75rem;">
                  <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Total Spent</span>
                  <div style="font-size:1.6rem; font-weight:800; color:var(--color-primary);">${formatCurrency(totalSpent)}</div>
                </div>
                <div>
                  <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Total Budget Limit</span>
                  <div style="font-size:1.25rem; font-weight:700; color:var(--text-primary);">${formatCurrency(totalAllocated)}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Highlight Cards: Top spent category and budget limits state -->
          <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
            <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:1rem;">Budget Status Overview</h3>
            <div style="display:flex; flex-direction:column; gap:0.85rem; flex:1; justify-content:center;">
              <div class="flex-between" style="padding:0.75rem 1rem; background:var(--bg-app); border-radius:var(--radius-md);">
                <span style="font-weight:600;">Total Remaining Budget</span>
                <span style="font-weight:800;" class="${totalRemaining >= 0 ? 'text-success' : 'text-danger'}">
                  ${totalRemaining >= 0 ? formatCurrency(totalRemaining) : '-' + formatCurrency(Math.abs(totalRemaining))}
                </span>
              </div>
              <div class="flex-between" style="padding:0.75rem 1rem; background:var(--bg-app); border-radius:var(--radius-md);">
                <span style="font-weight:600;">Limits state</span>
                <span class="status-pill ${totalPct > 90 ? 'danger' : (totalPct > 75 ? 'warning' : 'success')}">
                  ${totalPct > 90 ? 'Critical Attention' : (totalPct > 75 ? 'approaching limit' : 'on track')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Budget Cards Grid -->
        <h3 class="m-bottom-4" style="font-weight:800; font-size:1.2rem;">Categories Limits</h3>
        <div class="budget-grid">
          ${expenseCategories.map(c => {
            const spent = currentMonthTxs
              .filter(t => t.category_id === c.id)
              .reduce((sum, t) => sum + t.amount, 0);

            const limit = c.budget_limit || 0;
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const remaining = limit - spent;

            let statusClass = 'success';
            let statusText = 'on track';
            if (pct >= 100) {
              statusClass = 'danger';
              statusText = 'exceeded';
            } else if (pct >= 75) {
              statusClass = 'warning';
              statusText = 'need attention';
            }

            const expType = c.expense_type || 'variable';
            let expClass = 'success';
            if (expType === 'fixed') expClass = 'info';
            if (expType === 'discretionary') expClass = 'warning';

            return `
              <div class="budget-card">
                <div>
                  <div class="budget-header">
                    <div class="budget-cat-info">
                      <div class="budget-cat-icon" style="background:${c.color}18; color:${c.color};">
                        <i data-lucide="${c.icon || 'tag'}" style="width:18px; height:18px;"></i>
                      </div>
                      <div>
                        <div style="font-weight:800; font-size:1.05rem;">${c.name}</div>
                        <span class="status-pill ${expClass}" style="font-size:0.68rem; padding:0.15rem 0.45rem; margin-top:2px;">${expType}</span>
                      </div>
                    </div>

                    <button class="edit-cat-btn icon-btn" data-id="${c.id}" style="width:32px; height:32px;">
                      <i data-lucide="edit-2" style="width:12px; height:12px;"></i>
                    </button>
                  </div>

                  <div style="margin-top:1.25rem;">
                    <div class="flex-between" style="font-size:0.9rem; font-weight:700;">
                      <span>Spent: <span class="${pct >= 100 ? 'text-danger' : ''}">${formatCurrency(spent)}</span></span>
                      <span style="color:var(--text-muted);">Limit: ${formatCurrency(limit)}</span>
                    </div>
                    <div class="progress-bar-bg" style="height:8px; margin-top:0.5rem;">
                      <div class="progress-bar-fill" style="width:${Math.min(pct, 100)}%; background-color:${c.color};"></div>
                    </div>
                  </div>
                </div>

                <div class="flex-between" style="font-size:0.78rem; color:var(--text-secondary); margin-top:1.15rem; font-weight:600; border-top:1px solid var(--border-color); padding-top:0.75rem;">
                  <span class="status-pill ${statusClass}">${statusText} (${pct}%)</span>
                  <span class="${remaining < 0 ? 'text-danger' : ''}">
                    ${remaining >= 0 ? formatCurrency(remaining) + ' remaining' : formatCurrency(Math.abs(remaining)) + ' over limit'}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      if (window.lucide) lucide.createIcons();
      this.renderGaugeChart(totalPct);
      this.attachEvents(container);

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="color:var(--color-danger); padding:2rem; text-align:center;">
          <h3 style="margin-bottom:0.5rem;">Failed to load budget categories workspace</h3>
          <p style="font-size:0.9rem;">${err.message}</p>
        </div>`;
    }
  },

  renderGaugeChart(pct) {
    const ctx = document.getElementById('budget-overall-gauge')?.getContext('2d');
    if (!ctx) return;

    const remaining = Math.max(0, 100 - pct);
    const getThemeColor = (variable) => getComputedStyle(document.body).getPropertyValue(variable).trim();

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pct, remaining],
          backgroundColor: ['#6E54FF', getThemeColor('--border-color')],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '80%',
        rotation: -90,
        circumference: 180,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
  },

  attachEvents(container) {
    document.getElementById('add-category-btn').addEventListener('click', () => this.openCategoryModal());

    container.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-cat-btn');
      if (editBtn) {
        const id = parseInt(editBtn.getAttribute('data-id'));
        const cat = this.categories.find(c => c.id === id);
        if (cat) this.openCategoryModal(cat);
      }
    });
  },

  openCategoryModal(category = null) {
    const isEdit = !!category;

    const contentHTML = `
      <form id="category-form">
        <div class="form-group">
          <label>Category Label Name</label>
          <input type="text" id="modal-cat-name" class="form-control" value="${category ? category.name : ''}" placeholder="e.g. Dining Out" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Category Type</label>
            <select id="modal-cat-type" class="form-control">
              <option value="expense" ${category && category.type === 'expense' ? 'selected' : ''}>Expense Limit</option>
              <option value="income" ${category && category.type === 'income' ? 'selected' : ''}>Income Source</option>
            </select>
          </div>
          <div class="form-group">
            <label>Expense Classification</label>
            <select id="modal-cat-exptype" class="form-control">
              <option value="fixed" ${category && category.expense_type === 'fixed' ? 'selected' : ''}>Fixed (Rent, Subscriptions)</option>
              <option value="variable" ${category && category.expense_type === 'variable' ? 'selected' : ''}>Variable (Groceries, Fuel)</option>
              <option value="discretionary" ${category && category.expense_type === 'discretionary' ? 'selected' : ''}>Discretionary (Hobbies, Cafe)</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Monthly Budget Limit ($)</label>
            <input type="number" step="10" id="modal-cat-limit" class="form-control" value="${category ? category.budget_limit : 0}" placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Lucide Icon ID</label>
            <input type="text" id="modal-cat-icon" class="form-control" value="${category ? category.icon : 'tag'}" placeholder="e.g. shopping-cart, film...">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Color Theme</label>
            <input type="color" id="modal-cat-color" class="form-control" value="${category ? category.color : '#6E54FF'}" style="height:48px; padding:0.2rem; cursor:pointer;">
          </div>
          <div class="form-group" style="flex-direction:row; align-items:center; gap:0.6rem; margin-top:2rem;">
            <input type="checkbox" id="modal-cat-rollover" ${category && category.rollover ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
            <label for="modal-cat-rollover" style="margin:0; cursor:pointer; font-weight:700;">Enable rollover balance</label>
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: isEdit ? `Modify Category: ${category.name}` : 'Create Budget Category',
      contentHTML,
      onSave: async () => {
        const name = document.getElementById('modal-cat-name').value;
        const type = document.getElementById('modal-cat-type').value;
        const expense_type = document.getElementById('modal-cat-exptype').value;
        const budget_limit = parseFloat(document.getElementById('modal-cat-limit').value || 0);
        const icon = document.getElementById('modal-cat-icon').value || 'tag';
        const color = document.getElementById('modal-cat-color').value;
        const rollover = document.getElementById('modal-cat-rollover').checked;

        if (!name) {
          Toast.show('Category name is required', 'warning');
          return false;
        }

        if (isEdit) {
          await API.put(`/api/categories/${category.id}`, { name, type, expense_type, budget_limit, icon, color, rollover });
          Toast.show('Category limit updated!', 'success');
        } else {
          await API.post('/api/categories', { name, type, expense_type, budget_limit, icon, color, rollover });
          Toast.show('New budget category added!', 'success');
        }

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  }
};

const NeedsCalculatorPage = {
  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Calculating monthly needs & survival baseline...</div>`;

    try {
      const data = await API.get('/api/needs-calculator');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return (num < 0 ? '-' : '') + '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      container.innerHTML = `
        <div style="margin-bottom:1.5rem;">
          <h2 style="font-size:1.25rem; font-weight:700;">Monthly Needs & Survival Calculator</h2>
          <p style="color:var(--text-muted); font-size:0.88rem;">Know your exact baseline costs and evaluate your 50/30/20 budget ratio</p>
        </div>

        <!-- Summary Cards -->
        <div class="grid-cols-4">
          <div class="card stat-card">
            <div class="stat-header">
              <span>Expected Monthly Income</span>
              <div class="stat-icon success"><i data-lucide="arrow-down-left"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-success);">${formatCurrency(data.expected_income)}</div>
            <div class="stat-sub">Baseline income pool</div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Survival Cost (Baseline)</span>
              <div class="stat-icon danger"><i data-lucide="shield-alert"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-danger);">${formatCurrency(data.survival_cost)}</div>
            <div class="stat-sub">Fixed expenses + debt minimums</div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Total Need (Fixed + Variable)</span>
              <div class="stat-icon warning"><i data-lucide="calculator"></i></div>
            </div>
            <div class="stat-value">${formatCurrency(data.total_needed)}</div>
            <div class="stat-sub">All budget caps & minimums</div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Net Gap (Surplus/Deficit)</span>
              <div class="stat-icon primary"><i data-lucide="scale"></i></div>
            </div>
            <div class="stat-value" style="color:${data.net_gap < 0 ? 'var(--color-danger)' : 'var(--color-success)'};">${formatCurrency(data.net_gap)}</div>
            <div class="stat-sub">${data.net_gap >= 0 ? 'Surplus for savings & investment' : 'Monthly deficit! Need to cut costs'}</div>
          </div>
        </div>

        <!-- 50/30/20 Rule Comparison -->
        <div class="card" style="margin-bottom:1.5rem;">
          <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:1rem;">50 / 30 / 20 Budget Ratio Comparison</h3>
          
          <div style="display:flex; flex-direction:column; gap:1.25rem;">
            <!-- Needs (Target 50%) -->
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:0.3rem;">
                <span>Essentials & Debt Minimums (Needs)</span>
                <span>Actual: ${data.ratios.needs_pct}% / Target: 50%</span>
              </div>
              <div class="progress-bar-bg" style="height:12px;">
                <div class="progress-bar-fill" style="width:${Math.min(100, data.ratios.needs_pct)}%; background-color:${data.ratios.needs_pct > 60 ? 'var(--color-danger)' : 'var(--color-primary)'};"></div>
              </div>
            </div>

            <!-- Wants (Target 30%) -->
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:0.3rem;">
                <span>Variable & Discretionary Spending (Wants)</span>
                <span>Actual: ${data.ratios.wants_pct}% / Target: 30%</span>
              </div>
              <div class="progress-bar-bg" style="height:12px;">
                <div class="progress-bar-fill" style="width:${Math.min(100, data.ratios.wants_pct)}%; background-color:${data.ratios.wants_pct > 40 ? 'var(--color-warning)' : 'var(--color-info)'};"></div>
              </div>
            </div>

            <!-- Savings (Target 20%) -->
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:0.3rem;">
                <span>Savings & Debt Paydown Surplus (Savings)</span>
                <span>Actual: ${data.ratios.savings_pct}% / Target: 20%</span>
              </div>
              <div class="progress-bar-bg" style="height:12px;">
                <div class="progress-bar-fill" style="width:${Math.min(100, data.ratios.savings_pct)}%; background-color:var(--color-success);"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Expense Classification Breakdown -->
        <div class="card">
          <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:1rem;">Expense Classification Breakdown</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Classification</th>
                  <th>Icon</th>
                  <th style="text-align:right;">Budget Limit</th>
                </tr>
              </thead>
              <tbody>
                ${data.categories.map(c => `
                  <tr>
                    <td style="font-weight:600;">${c.name}</td>
                    <td>
                      <span style="font-size:0.75rem; text-transform:capitalize; font-weight:600; padding:0.2rem 0.55rem; border-radius:var(--radius-full); background:${c.expense_type === 'fixed' ? 'rgba(59, 130, 246, 0.15)' : (c.expense_type === 'variable' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)')}; color:${c.expense_type === 'fixed' ? 'var(--color-info)' : (c.expense_type === 'variable' ? 'var(--color-success)' : 'var(--color-warning)')};">
                        ${c.expense_type || 'variable'}
                      </span>
                    </td>
                    <td>
                      <div style="width:26px; height:26px; border-radius:var(--radius-md); background:${c.color}22; color:${c.color}; display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="${c.icon || 'tag'}" style="width:14px; height:14px;"></i>
                      </div>
                    </td>
                    <td style="text-align:right; font-weight:600;">${formatCurrency(c.budget_limit)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();

    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to calculate monthly needs: ${err.message}</div>`;
    }
  }
};

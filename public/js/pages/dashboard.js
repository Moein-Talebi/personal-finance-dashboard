const DashboardPage = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:200px;">
        <div style="color:var(--color-primary); font-weight:700;">Loading dashboard...</div>
      </div>`;
    
    try {
      const data = await API.get('/api/dashboard');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return (num < 0 ? '-' : '') + '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Helper to dynamically read theme colors for ChartJS
      const getThemeColor = (variable) => {
        return getComputedStyle(document.body).getPropertyValue(variable).trim();
      };

      container.innerHTML = `
        <!-- Welcome banner is handled in topbar, here is summary grid -->
        <div class="grid-cols-4 m-bottom-8">
          <div class="card stat-card">
            <div class="stat-header">
              <span>Total Net Worth</span>
              <div class="stat-icon primary"><i data-lucide="wallet"></i></div>
            </div>
            <div class="stat-value">${formatCurrency(data.net_worth)}</div>
            <div class="stat-sub">
              <span class="trend-badge up">
                <i data-lucide="trending-up" style="width:12px; height:12px;"></i> 12.1%
              </span>
              <span>vs last month</span>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Monthly Income</span>
              <div class="stat-icon success"><i data-lucide="arrow-down-left"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-success);">${formatCurrency(data.month_income)}</div>
            <div class="stat-sub">
              <span class="trend-badge up">
                <i data-lucide="trending-up" style="width:12px; height:12px;"></i> 6.3%
              </span>
              <span>vs last month</span>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Monthly Expenses</span>
              <div class="stat-icon danger"><i data-lucide="arrow-up-right"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-danger);">${formatCurrency(data.month_expense)}</div>
            <div class="stat-sub">
              <span class="trend-badge down">
                <i data-lucide="trending-down" style="width:12px; height:12px;"></i> 2.4%
              </span>
              <span>vs last month</span>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-header">
              <span>Total Debt Owed</span>
              <div class="stat-icon warning"><i data-lucide="credit-card"></i></div>
            </div>
            <div class="stat-value" style="color:var(--color-warning);">${formatCurrency(data.total_debt)}</div>
            <div class="stat-sub">
              <a href="#debts" class="trend-badge flat" style="text-decoration:none;">
                <span>Manage</span> &rarr;
              </a>
              <span>Active payoff</span>
            </div>
          </div>
        </div>

        <!-- Charts Row -->
        <div class="grid-cols-2 m-bottom-8">
          <!-- Money Flow Chart -->
          <div class="card">
            <div class="flex-between m-bottom-6">
              <h3 style="font-size:1.15rem; font-weight:800;">Money Flow</h3>
              <div class="chip-grid">
                <div class="chip-tag active">Income</div>
                <div class="chip-tag">Expense</div>
              </div>
            </div>
            <div style="height:250px;">
              <canvas id="dash-history-chart"></canvas>
            </div>
          </div>

          <!-- Budget Allocation Donut -->
          <div class="card">
            <div class="flex-between m-bottom-6">
              <h3 style="font-size:1.15rem; font-weight:800;">Budget Distribution</h3>
              <a href="#budget" style="font-size:0.85rem; font-weight:700; color:var(--color-primary);">Details &rarr;</a>
            </div>
            <div class="donut-widget" style="height:250px; display:flex; align-items:center; justify-content:center;">
              <div class="donut-chart-container">
                <canvas id="dash-category-chart"></canvas>
                <div class="donut-center-label">
                  <span class="donut-center-value">${Math.round(data.budget_usage_pct)}%</span>
                  <span class="donut-center-sub">Spent</span>
                </div>
              </div>
              <div class="donut-legend" id="donut-legend-container">
                <!-- Injected dynamically -->
              </div>
            </div>
          </div>
        </div>

        <!-- Cross-section Connection Row: Upcoming Bills & Upcoming Deadlines -->
        <div class="grid-cols-2 m-bottom-8">
          <!-- Upcoming Bills & Subscriptions -->
          <div class="card">
            <div class="flex-between m-bottom-6">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="width:32px; height:32px; border-radius:var(--radius-md); background:rgba(110, 84, 255, 0.12); color:var(--color-primary); display:flex; align-items:center; justify-content:center;">
                  <i data-lucide="repeat" style="width:16px; height:16px;"></i>
                </div>
                <h3 style="font-size:1.15rem; font-weight:800;">Upcoming Bills & Subscriptions</h3>
              </div>
              <a href="#recurring" style="font-size:0.85rem; font-weight:700; color:var(--color-primary);">View All &rarr;</a>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.85rem;">
              ${!data.upcoming_bills || data.upcoming_bills.length === 0 ? `
                <div style="color:var(--text-muted); text-align:center; padding:1.75rem; font-size:0.88rem;">
                  No active bills or subscriptions due soon.
                </div>
              ` : data.upcoming_bills.map(b => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = b.next_due < today;
                const isDueToday = b.next_due === today;

                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem; background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md);">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                      <div style="width:36px; height:36px; border-radius:var(--radius-full); background:var(--bg-tertiary); color:var(--color-primary); display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="credit-card" style="width:16px; height:16px;"></i>
                      </div>
                      <div>
                        <div style="font-weight:700; font-size:0.92rem; color:var(--text-primary);">${b.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem; margin-top:2px;">
                          <span>Due: <strong>${b.next_due}</strong></span>
                          <span>•</span>
                          <span>${b.category_name || 'Bill'}</span>
                        </div>
                      </div>
                    </div>

                    <div style="text-align:right;">
                      <div style="font-weight:800; font-size:0.95rem; color:var(--color-danger);">-${formatCurrency(b.amount)}</div>
                      <span style="font-size:0.7rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:var(--radius-full); background:${isOverdue ? 'rgba(239,68,68,0.15)' : (isDueToday ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)')}; color:${isOverdue ? 'var(--color-danger)' : (isDueToday ? 'var(--color-warning)' : 'var(--color-info)')};">
                        ${isOverdue ? 'Overdue' : (isDueToday ? 'Due Today' : 'Upcoming')}
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Upcoming Deadlines -->
          <div class="card">
            <div class="flex-between m-bottom-6">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="width:32px; height:32px; border-radius:var(--radius-md); background:rgba(245, 158, 11, 0.12); color:var(--color-warning); display:flex; align-items:center; justify-content:center;">
                  <i data-lucide="calendar-clock" style="width:16px; height:16px;"></i>
                </div>
                <h3 style="font-size:1.15rem; font-weight:800;">Financial Deadlines</h3>
              </div>
              <a href="#deadlines" style="font-size:0.85rem; font-weight:700; color:var(--color-primary);">Manage &rarr;</a>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.85rem;">
              ${!data.upcoming_deadlines || data.upcoming_deadlines.length === 0 ? `
                <div style="color:var(--text-muted); text-align:center; padding:1.75rem; font-size:0.88rem;">
                  No active deadlines pending.
                </div>
              ` : data.upcoming_deadlines.map(d => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = d.due_date < today;

                let priorityClass = 'info';
                if (d.priority === 'high') priorityClass = 'danger';
                if (d.priority === 'medium') priorityClass = 'warning';

                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem; background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md);">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                      <div style="width:36px; height:36px; border-radius:var(--radius-full); background:var(--bg-tertiary); color:${isOverdue ? 'var(--color-danger)' : 'var(--color-warning)'}; display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="alert-circle" style="width:16px; height:16px;"></i>
                      </div>
                      <div>
                        <div style="font-weight:700; font-size:0.92rem; color:var(--text-primary);">${d.title}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                          Due: <strong>${d.due_date}</strong>
                        </div>
                      </div>
                    </div>

                    <div style="text-align:right;">
                      ${d.amount > 0 ? `<div style="font-weight:800; font-size:0.95rem; color:var(--text-primary);">${formatCurrency(d.amount)}</div>` : ''}
                      <span class="status-pill ${priorityClass}" style="font-size:0.7rem; text-transform:capitalize;">${d.priority}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Lower Row: Recent transactions & Savings Goals -->
        <div class="grid-cols-2">
          <!-- Recent Transactions -->
          <div class="card">
            <div class="flex-between m-bottom-6">
              <h3 style="font-size:1.15rem; font-weight:800;">Recent Transactions</h3>
              <a href="#transactions" style="font-size:0.85rem; font-weight:700; color:var(--color-primary);">See All &rarr;</a>
            </div>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Account</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.recent_transactions.length === 0 ? `
                    <tr><td colspan="4" style="color:var(--text-muted); text-align:center; padding:2rem;">No recent activities</td></tr>
                  ` : data.recent_transactions.map(t => {
                    const typeClass = t.type === 'income' ? 'text-success' : '';
                    const prefix = t.type === 'income' ? '+' : '-';
                    return `
                      <tr>
                        <td>
                          <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:36px; height:36px; border-radius:var(--radius-full); background:${t.category_color}18; color:${t.category_color}; display:flex; align-items:center; justify-content:center;">
                              <i data-lucide="${t.category_icon || 'tag'}" style="width:18px; height:18px;"></i>
                            </div>
                            <span style="font-weight:700;">${t.category_name}</span>
                          </div>
                        </td>
                        <td style="color:var(--text-secondary); font-weight:500;">${t.date}</td>
                        <td>
                          <span class="status-pill info">${t.account_name}</span>
                        </td>
                        <td style="text-align:right; font-weight:800;" class="${typeClass}">
                          ${prefix}${formatCurrency(t.amount)}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Savings Goals -->
          <div class="card">
            <div class="flex-between m-bottom-6">
              <h3 style="font-size:1.15rem; font-weight:800;">Saving Goals</h3>
              <a href="#goals" style="font-size:0.85rem; font-weight:700; color:var(--color-primary);">Manage &rarr;</a>
            </div>

            <div style="display:flex; flex-direction:column; gap:1.25rem;">
              ${data.goals.length === 0 ? `
                <div style="color:var(--text-muted); text-align:center; padding:2rem;">Create goals to start tracking</div>
              ` : data.goals.map(g => {
                const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                return `
                  <div style="padding:1.15rem; background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md);">
                    <div class="flex-between m-bottom-4">
                      <div>
                        <span style="font-weight:800; font-size:1rem;">${g.name}</span>
                        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600; margin-top:2px;">Target amount: ${formatCurrency(g.target_amount)}</div>
                      </div>
                      <span class="status-pill success">${pct}% achieved</span>
                    </div>
                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-secondary); text-align:right; margin-bottom:4px;">
                      ${formatCurrency(g.current_amount)} saved
                    </div>
                    <div class="progress-bar-bg" style="height:8px;">
                      <div class="progress-bar-fill" style="width:${pct}%; background-color:${g.color || 'var(--color-primary)'};"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();

      // Donut Chart logic
      if (data.category_spending && data.category_spending.length > 0) {
        const ctxCat = document.getElementById('dash-category-chart').getContext('2d');
        const sortedCats = [...data.category_spending].sort((a,b) => b.total - a.total).slice(0, 5);
        
        new Chart(ctxCat, {
          type: 'doughnut',
          data: {
            labels: sortedCats.map(c => c.name),
            datasets: [{
              data: sortedCats.map(c => c.total),
              backgroundColor: sortedCats.map(c => c.color || '#6E54FF'),
              borderColor: getThemeColor('--bg-card'),
              borderWidth: 3,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
              legend: { display: false }
            }
          }
        });

        // Generate Custom Legend
        const legendContainer = document.getElementById('donut-legend-container');
        if (legendContainer) {
          legendContainer.innerHTML = sortedCats.map(c => `
            <div class="legend-item">
              <div class="legend-color" style="background:${c.color || '#6E54FF'}"></div>
              <span style="color:var(--text-secondary);">${c.name}</span>
              <span style="margin-left:auto; font-weight:800;">${formatCurrency(c.total)}</span>
            </div>
          `).join('');
        }
      }

      // Cashflow history trends bar chart
      if (data.monthly_history && data.monthly_history.length > 0) {
        const ctxHist = document.getElementById('dash-history-chart').getContext('2d');
        
        new Chart(ctxHist, {
          type: 'bar',
          data: {
            labels: data.monthly_history.map(m => m.month),
            datasets: [
              {
                label: 'Income',
                data: data.monthly_history.map(m => m.income),
                backgroundColor: '#6E54FF',
                borderRadius: 8,
                barThickness: 16
              },
              {
                label: 'Expense',
                data: data.monthly_history.map(m => m.expense),
                backgroundColor: '#FF970C',
                borderRadius: 8,
                barThickness: 16
              }
            ]
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
              legend: {
                position: 'top',
                align: 'end',
                labels: {
                  color: getThemeColor('--text-primary'),
                  boxWidth: 10,
                  boxHeight: 10,
                  usePointStyle: true,
                  font: { family: 'Outfit', weight: '700' }
                }
              }
            }
          }
        });
      }

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="color:var(--color-danger); padding:2rem; text-align:center;">
          <h3 style="margin-bottom:0.5rem;">Failed to load dashboard workspace</h3>
          <p style="font-size:0.9rem;">${err.message}</p>
        </div>`;
    }
  }
};

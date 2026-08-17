const AnalyticsPage = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:200px;">
        <div style="color:var(--color-primary); font-weight:700;">Loading financial analytics...</div>
      </div>`;

    try {
      const data = await API.get('/api/analytics');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const getThemeColor = (variable) => getComputedStyle(document.body).getPropertyValue(variable).trim();

      container.innerHTML = `
        <div class="flex-between m-bottom-8">
          <div>
            <h1 style="font-size:1.75rem; font-weight:800; letter-spacing:-0.02em;">Financial Analytics</h1>
            <p style="color:var(--text-secondary); font-size:0.95rem; font-weight:600; margin-top:4px;">
              Detailed view of your spending trends, histories and limits comparison
            </p>
          </div>

          <div class="chip-grid">
            <div class="chip-tag active">USD ($)</div>
            <div class="chip-tag">EUR (â‚¬)</div>
          </div>
        </div>

        <!-- Comparative Alert Banner -->
        <div class="card m-bottom-8" style="background:var(--color-primary-light); border:1px solid var(--color-primary); color:var(--text-primary);">
          <div style="display:flex; align-items:center; gap:0.85rem;">
            <div style="color:var(--color-primary);"><i data-lucide="info" style="width:24px; height:24px;"></i></div>
            <div style="font-weight:700; font-size:0.95rem;">
              You have extra <span style="color:var(--color-primary); font-weight:800;">$1,700</span> saved compared to last month! You are well within your budgets.
            </div>
          </div>
        </div>

        <!-- Analytics Charts Grid -->
        <div class="grid-cols-2 m-bottom-8">
          <!-- Total Balance Overview Area Chart -->
          <div class="card">
            <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:1.25rem;">Total Balance Overview</h3>
            <div style="height:280px;">
              <canvas id="analytics-balance-chart"></canvas>
            </div>
          </div>

          <!-- Budget vs Expense Bar Comparison -->
          <div class="card">
            <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:1.25rem;">Budget vs Expense Comparison</h3>
            <div style="height:280px;">
              <canvas id="analytics-compare-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Donut breakdown and Category Ledger list -->
        <div class="grid-cols-2">
          <div class="card">
            <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:1.25rem;">Spending by Category</h3>
            <div class="donut-widget" style="height:260px; display:flex; align-items:center; justify-content:center;">
              <div class="donut-chart-container" style="width: 150px; height: 150px;">
                <canvas id="analytics-donut-chart"></canvas>
              </div>
              <div class="donut-legend" id="analytics-legend-container">
                <!-- Injected dynamically -->
              </div>
            </div>
          </div>

          <!-- Top Categories Ledger list -->
          <div class="card">
            <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:1rem;">Top Category Ledger</h3>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style="text-align:right;">Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.top_categories.length === 0 ? `
                    <tr><td colspan="2" style="color:var(--text-muted); text-align:center; padding:3rem;">No activities to report</td></tr>
                  ` : data.top_categories.map(c => `
                    <tr>
                      <td>
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                          <div style="width:36px; height:36px; border-radius:var(--radius-full); background:${c.color || '#6E54FF'}18; color:${c.color || '#6E54FF'}; display:flex; align-items:center; justify-content:center;">
                            <i data-lucide="${c.icon || 'tag'}" style="width:18px; height:18px;"></i>
                          </div>
                          <span style="font-weight:700;">${c.name}</span>
                        </div>
                      </td>
                      <td style="text-align:right; font-weight:800; color:var(--color-danger); font-size:1.05rem;">
                        ${formatCurrency(c.total)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();

      // Render area line chart
      const ctxBal = document.getElementById('analytics-balance-chart')?.getContext('2d');
      if (ctxBal) {
        const gradient = ctxBal.createLinearGradient(0, 0, 0, 240);
        gradient.addColorStop(0, 'rgba(110, 84, 255, 0.35)');
        gradient.addColorStop(1, 'rgba(110, 84, 255, 0.00)');

        new Chart(ctxBal, {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            datasets: [{
              label: 'Portfolio Worth',
              data: [11000, 12500, 11800, 13900, 14800, 15700, 16400],
              borderColor: '#6E54FF',
              borderWidth: 3.5,
              backgroundColor: gradient,
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#6E54FF'
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
      }

      // Render Bar comparisons chart
      const ctxComp = document.getElementById('analytics-compare-chart')?.getContext('2d');
      if (ctxComp && data.monthly_history && data.monthly_history.length > 0) {
        new Chart(ctxComp, {
          type: 'bar',
          data: {
            labels: data.monthly_history.map(m => m.month),
            datasets: [
              {
                label: 'Income',
                data: data.monthly_history.map(m => m.income),
                backgroundColor: '#6E54FF',
                borderRadius: 6,
                barThickness: 14
              },
              {
                label: 'Expense',
                data: data.monthly_history.map(m => m.expense),
                backgroundColor: '#FF970C',
                borderRadius: 6,
                barThickness: 14
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
                  boxWidth: 8,
                  boxHeight: 8,
                  usePointStyle: true,
                  font: { family: 'Outfit', weight: '700' }
                }
              }
            }
          }
        });
      }

      // Render Donut chart
      if (data.category_spending && data.category_spending.length > 0) {
        const ctxDonut = document.getElementById('analytics-donut-chart').getContext('2d');
        const sortedCats = [...data.category_spending].sort((a,b) => b.total - a.total).slice(0, 5);

        new Chart(ctxDonut, {
          type: 'doughnut',
          data: {
            labels: sortedCats.map(c => c.name),
            datasets: [{
              data: sortedCats.map(c => c.total),
              backgroundColor: sortedCats.map(c => c.color || '#6E54FF'),
              borderColor: getThemeColor('--bg-card'),
              borderWidth: 2,
              hoverOffset: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: { display: false }
            }
          }
        });

        // Legend details
        const legendContainer = document.getElementById('analytics-legend-container');
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

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="color:var(--color-danger); padding:2rem; text-align:center;">
          <h3 style="margin-bottom:0.5rem;">Failed to load financial analytics</h3>
          <p style="font-size:0.9rem;">${err.message}</p>
        </div>`;
    }
  }
};

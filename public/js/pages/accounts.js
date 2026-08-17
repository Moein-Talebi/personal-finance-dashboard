const AccountsPage = {
  accounts: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:200px;">
        <div style="color:var(--color-primary); font-weight:700;">Loading wallets...</div>
      </div>`;

    try {
      this.accounts = await API.get('/api/accounts');

      const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return (num < 0 ? '-' : '') + '�' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const totalBalance = this.accounts.reduce((sum, a) => sum + a.balance, 0);

      container.innerHTML = `
        <div class="flex-between m-bottom-8">
          <div>
            <h1 style="font-size:1.75rem; font-weight:800; letter-spacing:-0.02em;">Wallet & Accounts</h1>
            <div style="color:var(--text-secondary); font-size:0.95rem; font-weight:600; margin-top:4px;">
              Total Balance: <span style="color:var(--color-primary); font-weight:800;">${formatCurrency(totalBalance)}</span>
            </div>
          </div>

          <div style="display:flex; gap:0.85rem;">
            <button class="btn btn-secondary" id="transfer-btn">
              <i data-lucide="arrow-left-right"></i> <span>Transfer</span>
            </button>
            <button class="btn btn-primary" id="add-account-btn">
              <i data-lucide="plus"></i> <span>Add Account</span>
            </button>
          </div>
        </div>

        <!-- Cards Carousel / Grid -->
        <h3 class="m-bottom-4" style="font-weight:800; font-size:1.2rem;">Your Accounts</h3>
        <div class="grid-cols-2 m-bottom-8">
          ${this.accounts.map((a, index) => {
            const gradClass = `finance-card-gradient-${(index % 3) + 1}`;
            
            // Generate some card icon based on type
            let iconText = 'VISA';
            if (a.type === 'savings') iconText = 'SAVINGS';
            if (a.type === 'credit') iconText = 'MASTERCARD';
            if (a.type === 'cash') iconText = 'CASH';
            if (a.type === 'investment') iconText = 'INVEST';

            return `
              <div class="finance-card ${gradClass}">
                <div class="finance-card-header">
                  <span style="font-weight:800; font-size:1rem; letter-spacing:1px;">${iconText}</span>
                  
                  <div style="display:flex; gap:0.5rem; align-items:center;">
                    <button class="edit-acct-btn" data-id="${a.id}" style="background:rgba(255,255,255,0.2); border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#FFF;">
                      <i data-lucide="edit-2" style="width:12px; height:12px;"></i>
                    </button>
                    <button class="delete-acct-btn" data-id="${a.id}" style="background:rgba(255,255,255,0.2); border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#FFF;">
                      <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                    </button>
                  </div>
                </div>

                <div class="finance-card-number">
                  •••• •••• •••• 32${a.id}5
                </div>

                <div class="finance-card-footer">
                  <div>
                    <span style="font-size:0.75rem; opacity:0.8; font-weight:500;">Card Holder</span>
                    <div style="font-weight:700; font-size:0.95rem;">${a.name}</div>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-size:0.75rem; opacity:0.8; font-weight:500;">Balance</span>
                    <div style="font-weight:800; font-size:1.35rem;">${formatCurrency(a.balance)}</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Account Balance Trend Graph -->
        <div class="card">
          <div class="flex-between m-bottom-6">
            <h3 style="font-size:1.15rem; font-weight:800;">Balance Trend & Statistics</h3>
            <span class="status-pill success">All accounts aggregated</span>
          </div>
          <div style="height:250px;">
            <canvas id="wallet-trend-chart"></canvas>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
      this.renderTrendChart();
      this.attachEvents(container);

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="color:var(--color-danger); padding:2rem; text-align:center;">
          <h3 style="margin-bottom:0.5rem;">Failed to load accounts workspace</h3>
          <p style="font-size:0.9rem;">${err.message}</p>
        </div>`;
    }
  },

  renderTrendChart() {
    const ctx = document.getElementById('wallet-trend-chart')?.getContext('2d');
    if (!ctx) return;

    const getThemeColor = (variable) => getComputedStyle(document.body).getPropertyValue(variable).trim();

    // Create gradient fill for area chart
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(110, 84, 255, 0.35)');
    gradient.addColorStop(1, 'rgba(110, 84, 255, 0.00)');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        datasets: [{
          label: 'Portfolio Value',
          data: [12000, 13400, 12900, 14200, 15100, 15700, 16400],
          borderColor: '#6E54FF',
          borderWidth: 3,
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
  },

  attachEvents(container) {
    document.getElementById('add-account-btn').addEventListener('click', () => this.openAccountModal());
    document.getElementById('transfer-btn').addEventListener('click', () => this.openTransferModal());

    container.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-acct-btn');
      if (editBtn) {
        const id = parseInt(editBtn.getAttribute('data-id'));
        const acct = this.accounts.find(a => a.id === id);
        if (acct) this.openAccountModal(acct);
      }

      const deleteBtn = e.target.closest('.delete-acct-btn');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute('data-id'));
        if (confirm('Delete this account and all its transaction history?')) {
          await API.delete(`/api/accounts/${id}`);
          Toast.show('Account and ledger history deleted', 'success');
          this.render(container);
        }
      }
    });
  },

  openAccountModal(acct = null) {
    const isEdit = !!acct;

    const contentHTML = `
      <form id="acct-form">
        <div class="form-group">
          <label>Account / Card Name</label>
          <input type="text" id="modal-acct-name" class="form-control" value="${acct ? acct.name : ''}" placeholder="e.g. Visa Primary" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select id="modal-acct-type" class="form-control">
              <option value="checking" ${acct && acct.type === 'checking' ? 'selected' : ''}>Checking Account</option>
              <option value="savings" ${acct && acct.type === 'savings' ? 'selected' : ''}>Savings Account</option>
              <option value="credit" ${acct && acct.type === 'credit' ? 'selected' : ''}>Credit Card</option>
              <option value="cash" ${acct && acct.type === 'cash' ? 'selected' : ''}>Cash Wallet</option>
              <option value="investment" ${acct && acct.type === 'investment' ? 'selected' : ''}>Investment Account</option>
            </select>
          </div>
          <div class="form-group">
            <label>Initial Balance ($)</label>
            <input type="number" step="0.01" id="modal-acct-balance" class="form-control" value="${acct ? acct.balance : 0}" placeholder="0.00" required>
          </div>
        </div>

        <div class="form-group">
          <label>Theme Style Color</label>
          <input type="color" id="modal-acct-color" class="form-control" value="${acct ? acct.color : '#6E54FF'}" style="height:48px; padding:0.2rem; cursor:pointer;">
        </div>
      </form>
    `;

    Modal.open({
      title: isEdit ? `Edit Wallet: ${acct.name}` : 'Create New Account Card',
      contentHTML,
      onSave: async () => {
        const name = document.getElementById('modal-acct-name').value;
        const type = document.getElementById('modal-acct-type').value;
        const balance = parseFloat(document.getElementById('modal-acct-balance').value || 0);
        const color = document.getElementById('modal-acct-color').value;

        if (!name) {
          Toast.show('Account name is required', 'warning');
          return false;
        }

        if (isEdit) {
          await API.put(`/api/accounts/${acct.id}`, { name, type, balance, color });
          Toast.show('Wallet card updated successfully!', 'success');
        } else {
          await API.post('/api/accounts', { name, type, balance, color });
          Toast.show('New wallet card added!', 'success');
        }

        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  },

  openTransferModal() {
    const today = new Date().toISOString().split('T')[0];

    const contentHTML = `
      <form id="transfer-form">
        <div class="form-row">
          <div class="form-group">
            <label>Source Wallet Card</label>
            <select id="transfer-from" class="form-control">
              ${this.accounts.map(a => `<option value="${a.id}">${a.name} ($${a.balance.toFixed(2)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Destination Wallet Card</label>
            <select id="transfer-to" class="form-control">
              ${this.accounts.map(a => `<option value="${a.id}">${a.name} ($${a.balance.toFixed(2)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Transfer Amount ($)</label>
            <input type="number" step="0.01" id="transfer-amount" class="form-control" placeholder="0.00" required>
          </div>
          <div class="form-group">
            <label>Transfer Date</label>
            <input type="date" id="transfer-date" class="form-control" value="${today}">
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: 'Move Funds internally',
      contentHTML,
      onSave: async () => {
        const fromId = document.getElementById('transfer-from').value;
        const toId = document.getElementById('transfer-to').value;
        const amount = parseFloat(document.getElementById('transfer-amount').value || 0);
        const date = document.getElementById('transfer-date').value;

        if (fromId === toId) {
          Toast.show('Source and destination accounts must be different', 'warning');
          return false;
        }

        if (!amount || amount <= 0) {
          Toast.show('Please enter a valid transfer amount', 'warning');
          return false;
        }

        const cats = await API.get('/api/categories');
        const defaultCat = cats[0] ? cats[0].id : 1;

        await API.post('/api/transactions', {
          type: 'transfer',
          account_id: fromId,
          target_account_id: toId,
          category_id: defaultCat,
          amount: amount,
          date: date,
          note: `Internal transfer to ${this.accounts.find(a => a.id == toId)?.name || 'account'}`
        });

        Toast.show('Internal transfer completed successfully!', 'success');
        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });
  }
};

const TransactionsPage = {
  transactions: [],
  accounts: [],
  categories: [],
  filters: {
    search: '',
    accountId: '',
    categoryId: '',
    type: ''
  },

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:200px;">
        <div style="color:var(--color-primary); font-weight:700;">Loading ledger...</div>
      </div>`;

    try {
      const [txRes, acctRes, catRes] = await Promise.all([
        API.get('/api/transactions'),
        API.get('/api/accounts'),
        API.get('/api/categories')
      ]);

      this.transactions = txRes;
      this.accounts = acctRes;
      this.categories = catRes;

      this.renderWorkspace(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="color:var(--color-danger); padding:2rem; text-align:center;">
          <h3 style="margin-bottom:0.5rem;">Failed to load transactions workspace</h3>
          <p style="font-size:0.9rem;">${err.message}</p>
        </div>`;
    }
  },

  renderWorkspace(container) {
    container.innerHTML = `
      <!-- Search & Filters Container -->
      <div class="card m-bottom-6">
        <div style="display:flex; flex-wrap:wrap; gap:1.25rem; align-items:center; justify-content:space-between;">
          <div style="display:flex; flex-wrap:wrap; gap:0.85rem; align-items:center; flex:1; min-width:300px;">
            <input type="text" id="tx-search" class="form-control" style="max-width:240px;" placeholder="Search note/memo..." value="${this.filters.search}">
            
            <select id="tx-account-filter" class="form-control" style="max-width:180px;">
              <option value="">All Accounts</option>
              ${this.accounts.map(a => `<option value="${a.id}" ${this.filters.accountId == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>

            <select id="tx-category-filter" class="form-control" style="max-width:180px;">
              <option value="">All Categories</option>
              ${this.categories.map(c => `<option value="${c.id}" ${this.filters.categoryId == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>

            <select id="tx-type-filter" class="form-control" style="max-width:150px;">
              <option value="">All Types</option>
              <option value="expense" ${this.filters.type === 'expense' ? 'selected' : ''}>Expense</option>
              <option value="income" ${this.filters.type === 'income' ? 'selected' : ''}>Income</option>
              <option value="transfer" ${this.filters.type === 'transfer' ? 'selected' : ''}>Transfer</option>
            </select>
          </div>

          <div style="display:flex; gap:0.85rem; align-items:center;">
            <a href="/api/transactions/export" download="transactions.csv" class="btn btn-outline" id="export-csv-btn">
              <i data-lucide="download"></i> <span>Export CSV</span>
            </a>
            <button class="btn btn-primary" id="add-tx-btn">
              <i data-lucide="plus"></i> <span>Add Transaction</span>
            </button>
          </div>
        </div>

        <!-- Dynamic Filter Tags -->
        <div class="chip-grid" id="active-filters-chips" style="margin-top:1.25rem; border-top:1px solid var(--border-color); padding-top:1rem; display:${this.hasActiveFilters() ? 'flex' : 'none'};">
          <!-- Filter chips injected here -->
        </div>
      </div>

      <!-- Ledger Table -->
      <div class="card">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note / Memo</th>
                <th>Account</th>
                <th>Status</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:center; width:80px;">Actions</th>
              </tr>
            </thead>
            <tbody id="tx-table-body">
              <!-- Injected by filter logic -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.renderFilterTags();
    this.filterData();
    this.attachEvents(container);
  },

  hasActiveFilters() {
    return this.filters.search || this.filters.accountId || this.filters.categoryId || this.filters.type;
  },

  renderFilterTags() {
    const chipsContainer = document.getElementById('active-filters-chips');
    if (!chipsContainer) return;

    let html = '';

    if (this.filters.search) {
      html += `<div class="chip-tag active" data-clear="search">Note: "${this.filters.search}" <i data-lucide="x" style="width:14px; height:14px;"></i></div>`;
    }
    if (this.filters.accountId) {
      const name = this.accounts.find(a => a.id == this.filters.accountId)?.name || 'Account';
      html += `<div class="chip-tag active" data-clear="accountId">${name} <i data-lucide="x" style="width:14px; height:14px;"></i></div>`;
    }
    if (this.filters.categoryId) {
      const name = this.categories.find(c => c.id == this.filters.categoryId)?.name || 'Category';
      html += `<div class="chip-tag active" data-clear="categoryId">${name} <i data-lucide="x" style="width:14px; height:14px;"></i></div>`;
    }
    if (this.filters.type) {
      html += `<div class="chip-tag active" data-clear="type">${this.filters.type} <i data-lucide="x" style="width:14px; height:14px;"></i></div>`;
    }

    if (html) {
      html += `<div class="chip-tag" id="reset-all-filters" style="border-style:dashed;">Reset all</div>`;
      chipsContainer.innerHTML = html;
      chipsContainer.style.display = 'flex';
    } else {
      chipsContainer.style.display = 'none';
    }

    if (window.lucide) lucide.createIcons();
  },

  filterData() {
    const search = this.filters.search.toLowerCase();
    const accountId = this.filters.accountId;
    const categoryId = this.filters.categoryId;
    const type = this.filters.type;

    let filtered = this.transactions;

    if (accountId) filtered = filtered.filter(t => t.account_id == accountId);
    if (categoryId) filtered = filtered.filter(t => t.category_id == categoryId);
    if (type) filtered = filtered.filter(t => t.type === type);
    if (search) filtered = filtered.filter(t => (t.note || '').toLowerCase().includes(search));

    const tbody = document.getElementById('tx-table-body');
    if (tbody) {
      tbody.innerHTML = this.renderRows(filtered);
      if (window.lucide) lucide.createIcons();
    }
  },

  renderRows(txList) {
    const formatCurrency = (val) => {
      const num = parseFloat(val || 0);
      return '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    if (!txList || txList.length === 0) {
      return `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:3rem; font-weight:600;">No ledger activities match current filters</td></tr>`;
    }

    return txList.map(t => {
      // FinSet status display simulator
      let statusClass = 'successful';
      let statusText = 'successful';
      if (t.id % 12 === 0) {
        statusClass = 'pending';
        statusText = 'pending';
      } else if (t.id % 20 === 0) {
        statusClass = 'refund';
        statusText = 'refund';
      } else if (t.id % 25 === 0) {
        statusClass = 'cancelled';
        statusText = 'cancelled';
      }

      return `
        <tr>
          <td style="color:var(--text-secondary); font-weight:600;">${t.date}</td>
          <td>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div style="width:36px; height:36px; border-radius:var(--radius-full); background:${t.category_color || '#6E54FF'}18; color:${t.category_color || '#6E54FF'}; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="${t.category_icon || 'tag'}" style="width:18px; height:18px;"></i>
              </div>
              <span style="font-weight:700;">${t.category_name}</span>
            </div>
          </td>
          <td style="color:var(--text-secondary); font-weight:500;">${t.note || '—'}</td>
          <td>
            <span style="font-weight:600; color:var(--text-primary);">${t.account_name}</span>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusText}</span>
          </td>
          <td style="text-align:right; font-weight:800; color: ${t.type === 'income' ? 'var(--color-success)' : 'var(--text-primary)'}; font-size:1.05rem;">
            ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
          </td>
          <td style="text-align:center;">
            <button class="icon-btn delete-tx-btn" data-id="${t.id}" style="width:36px; height:36px; border:none; background:transparent;">
              <i data-lucide="trash-2" style="width:16px; height:16px; color:var(--color-danger);"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  attachEvents(container) {
    const searchEl = document.getElementById('tx-search');
    const acctEl = document.getElementById('tx-account-filter');
    const catEl = document.getElementById('tx-category-filter');
    const typeEl = document.getElementById('tx-type-filter');

    const updateFiltersState = () => {
      this.filters.search = searchEl.value;
      this.filters.accountId = acctEl.value;
      this.filters.categoryId = catEl.value;
      this.filters.type = typeEl.value;

      this.renderFilterTags();
      this.filterData();
    };

    if (searchEl) {
      searchEl.addEventListener('keyup', updateFiltersState);
      searchEl.addEventListener('change', updateFiltersState);
    }
    if (acctEl) acctEl.addEventListener('change', updateFiltersState);
    if (catEl) catEl.addEventListener('change', updateFiltersState);
    if (typeEl) typeEl.addEventListener('change', updateFiltersState);

    // Event delegation for filter chips
    const chipsContainer = document.getElementById('active-filters-chips');
    if (chipsContainer) {
      chipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip-tag');
        if (!chip) return;

        const clearAttr = chip.getAttribute('data-clear');
        if (clearAttr) {
          this.filters[clearAttr] = '';
          if (clearAttr === 'search') searchEl.value = '';
          if (clearAttr === 'accountId') acctEl.value = '';
          if (clearAttr === 'categoryId') catEl.value = '';
          if (clearAttr === 'type') typeEl.value = '';

          updateFiltersState();
        } else if (chip.id === 'reset-all-filters') {
          this.filters = { search: '', accountId: '', categoryId: '', type: '' };
          searchEl.value = '';
          acctEl.value = '';
          catEl.value = '';
          typeEl.value = '';

          updateFiltersState();
        }
      });
    }

    document.getElementById('add-tx-btn').addEventListener('click', () => this.openAddModal());

    container.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-tx-btn');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this transaction? Balance adjustments will apply.')) {
          await API.delete(`/api/transactions/${id}`);
          Toast.show('Transaction deleted successfully', 'success');
          this.render(container);
        }
      }
    });
  },

  openAddModal() {
    const today = new Date().toISOString().split('T')[0];

    const contentHTML = `
      <!-- Modal Type Switch Tabs -->
      <div class="modal-tabs">
        <button type="button" class="modal-tab-btn active" data-type="expense">Expense</button>
        <button type="button" class="modal-tab-btn" data-type="income">Income</button>
        <button type="button" class="modal-tab-btn" data-type="transfer">Transfer</button>
      </div>

      <form id="add-tx-form">
        <!-- Hidden actual input type -->
        <input type="hidden" id="modal-tx-type" value="expense">

        <div class="form-group">
          <label>Amount (€)</label>
          <input type="number" step="0.01" id="modal-tx-amount" class="form-control" placeholder="0.00" style="font-size:1.5rem; font-weight:800; text-align:center; padding:1rem;" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Payment Account</label>
            <select id="modal-tx-account" class="form-control" required>
              ${this.accounts.map(a => `<option value="${a.id}">${a.name} (€${a.balance.toFixed(2)})</option>`).join('')}
            </select>
          </div>

          <div class="form-group" id="category-group">
            <label>Category</label>
            <select id="modal-tx-category" class="form-control" required>
              ${this.categories.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join('')}
            </select>
          </div>

          <div class="form-group hidden" id="target-account-group">
            <label>Recipient Account</label>
            <select id="modal-tx-target-account" class="form-control">
              ${this.accounts.map(a => `<option value="${a.id}">${a.name} (€${a.balance.toFixed(2)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="modal-tx-date" class="form-control" value="${today}" required>
          </div>
          
          <div class="form-group">
            <label>Description / Note</label>
            <input type="text" id="modal-tx-note" class="form-control" placeholder="e.g. Sushi lunch">
          </div>
        </div>
      </form>
    `;

    Modal.open({
      title: 'Adding a transaction',
      contentHTML,
      onSave: async () => {
        const type = document.getElementById('modal-tx-type').value;
        const amount = parseFloat(document.getElementById('modal-tx-amount').value);
        const account_id = document.getElementById('modal-tx-account').value;
        const category_id = document.getElementById('modal-tx-category').value;
        const target_account_id = document.getElementById('modal-tx-target-account').value;
        const date = document.getElementById('modal-tx-date').value;
        const note = document.getElementById('modal-tx-note').value;

        if (!amount || amount <= 0) {
          Toast.show('Please enter a valid positive amount', 'warning');
          return false;
        }

        await API.post('/api/transactions', {
          type,
          amount,
          account_id,
          category_id: type === 'transfer' ? this.categories[0].id : category_id,
          target_account_id: type === 'transfer' ? target_account_id : null,
          date,
          note
        });

        Toast.show('Transaction added successfully!', 'success');
        const container = document.getElementById('page-content');
        this.render(container);
        return true;
      }
    });

    // Wire Up Modal Tab Switch Logic
    const tabBtns = document.querySelectorAll('.modal-tab-btn');
    const typeInput = document.getElementById('modal-tx-type');
    const catGroup = document.getElementById('category-group');
    const targetGroup = document.getElementById('target-account-group');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const type = btn.getAttribute('data-type');
        typeInput.value = type;

        if (type === 'transfer') {
          catGroup.classList.add('hidden');
          targetGroup.classList.remove('hidden');
        } else {
          catGroup.classList.remove('hidden');
          targetGroup.classList.add('hidden');
        }
      });
    });
  }
};

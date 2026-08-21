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
            <button class="btn btn-outline" id="import-csv-btn">
              <i data-lucide="upload"></i> <span>Import CSV</span>
            </button>
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

    const importBtn = document.getElementById('import-csv-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.openImportModal());
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
  },

  openImportModal() {
    let parsedRows = [];

    const contentHTML = `
      <div>
        <!-- File Dropzone -->
        <div class="file-dropzone" id="csv-dropzone">
          <i data-lucide="upload-cloud" style="width:36px; height:36px; color:var(--color-primary);"></i>
          <div style="font-weight:700; font-size:1.05rem;">Choose CSV File or Drag & Drop</div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">Supports exported ledger CSVs or standard bank transaction exports</div>
          <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display:none;">
          <button type="button" class="btn btn-outline" style="margin-top:0.5rem;" id="browse-csv-btn">
            <i data-lucide="file-text"></i> <span>Select CSV File</span>
          </button>
        </div>

        <!-- Fallback Defaults Form -->
        <div style="margin-top:1.25rem;">
          <div class="form-group">
            <label>Payment Account (if unassigned in CSV)</label>
            <select id="import-default-account" class="form-control">
              ${this.accounts.map(a => `<option value="${a.id}">${a.name} (€${a.balance.toFixed(2)})</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- CSV Preview Container -->
        <div id="csv-preview-section" style="display:none; margin-top:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <i data-lucide="file-check" style="width:18px; height:18px; color:var(--color-success);"></i>
              <span id="csv-file-name" style="font-weight:700; font-size:0.95rem;">file.csv</span>
            </div>
            <div id="csv-stats-badge" style="font-size:0.85rem; font-weight:700; color:var(--color-primary);"></div>
          </div>

          <div class="csv-preview-container">
            <table class="csv-preview-table">
              <thead>
                <tr>
                  <th style="width:40px;">#</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th>Note / Memo</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody id="csv-preview-tbody">
                <!-- Injected after parsing -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    Modal.open({
      title: 'Import Transactions from CSV',
      size: 'lg',
      saveText: 'Import Transactions',
      contentHTML,
      onSave: async () => {
        if (!parsedRows || parsedRows.length === 0) {
          Toast.show('Please upload a CSV file containing transaction records', 'warning');
          return false;
        }

        const validRows = parsedRows.filter(r => r.isValid);
        if (validRows.length === 0) {
          Toast.show('No valid transaction rows found in the uploaded file', 'warning');
          return false;
        }

        const defaultAccountId = parseInt(document.getElementById('import-default-account').value);
        const defaultIncomeCat = this.categories.find(c => c.type === 'income') || this.categories[0];
        const defaultExpenseCat = this.categories.find(c => c.type === 'expense') || this.categories[0];

        const payload = validRows.map(r => {
          let accId = defaultAccountId;
          if (r.account_name) {
            const foundAcc = this.accounts.find(a => a.name.toLowerCase() === r.account_name.toLowerCase() || a.name.toLowerCase().includes(r.account_name.toLowerCase()));
            if (foundAcc) accId = foundAcc.id;
          }

          let catId = r.type === 'income' ? defaultIncomeCat.id : defaultExpenseCat.id;
          if (r.category_name) {
            const foundCat = this.categories.find(c => c.name.toLowerCase() === r.category_name.toLowerCase() || c.name.toLowerCase().includes(r.category_name.toLowerCase()));
            if (foundCat) catId = foundCat.id;
          }

          return {
            date: r.date,
            type: r.type,
            amount: r.amount,
            account_id: accId,
            account_name: r.account_name || undefined,
            category_id: catId,
            note: r.note || ''
          };
        });

        try {
          const res = await API.post('/api/transactions/import', { transactions: payload });
          Toast.show(res.message || `Successfully imported ${res.count || payload.length} transactions!`, 'success');
          const container = document.getElementById('page-content');
          this.render(container);
          return true;
        } catch (err) {
          // If server was started before adding /api/transactions/import and returns 404,
          // fallback to individual POST /api/transactions requests
          if (err.message && err.message.includes('404')) {
            try {
              let successCount = 0;
              for (const tx of payload) {
                await API.post('/api/transactions', {
                  type: tx.type,
                  amount: tx.amount,
                  account_id: tx.account_id,
                  category_id: tx.category_id,
                  date: tx.date,
                  note: tx.note
                });
                successCount++;
              }
              Toast.show(`Successfully imported ${successCount} transactions!`, 'success');
              const container = document.getElementById('page-content');
              this.render(container);
              return true;
            } catch (fallbackErr) {
              Toast.show(`Import failed: ${fallbackErr.message}`, 'danger');
              return false;
            }
          }
          Toast.show(`Import failed: ${err.message}`, 'danger');
          return false;
        }
      }
    });

    // Wire Up File Selection & Drag-and-Drop
    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file-input');
    const browseBtn = document.getElementById('browse-csv-btn');
    const previewSection = document.getElementById('csv-preview-section');
    const fileNameEl = document.getElementById('csv-file-name');
    const statsBadgeEl = document.getElementById('csv-stats-badge');
    const previewTbody = document.getElementById('csv-preview-tbody');

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFile(e.target.files[0]);
        }
      });
    }

    const defaultAccountSelect = document.getElementById('import-default-account');

    const renderPreviewTable = () => {
      if (!parsedRows || parsedRows.length === 0) return;

      const validCount = parsedRows.filter(r => r.isValid).length;
      const totalAmount = parsedRows.reduce((sum, r) => sum + (r.isValid ? r.amount : 0), 0);

      const selAcctText = defaultAccountSelect?.options[defaultAccountSelect.selectedIndex]?.text.split('(')[0].trim() || 'Default';

      statsBadgeEl.textContent = `${validCount} of ${parsedRows.length} rows ready (Total: ${window.formatCurrency(totalAmount)})`;

      previewTbody.innerHTML = parsedRows.map((r, idx) => {
        const typeClass = r.type === 'income' ? 'success' : (r.type === 'transfer' ? 'info' : 'danger');
        const typeSymbol = r.type === 'income' ? '+' : (r.type === 'transfer' ? '' : '-');
        const displayAcct = r.account_name || `<span style="color:var(--text-secondary); font-style:italic;">${selAcctText}</span>`;

        return `
          <tr style="${r.isValid ? '' : 'opacity:0.5; background:var(--color-danger-bg);'}">
            <td style="color:var(--text-muted); font-weight:600;">${idx + 1}</td>
            <td style="font-weight:600;">${r.date}</td>
            <td><span class="status-pill ${typeClass}" style="padding:0.15rem 0.5rem; font-size:0.72rem;">${r.type}</span></td>
            <td>${displayAcct}</td>
            <td style="max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.note || ''}">${r.note || '—'}</td>
            <td style="text-align:right; font-weight:700; color:${r.type === 'income' ? 'var(--color-success)' : 'var(--text-primary)'};">
              ${typeSymbol}${window.formatCurrency(r.amount)}
            </td>
          </tr>
        `;
      }).join('');

      previewSection.style.display = 'block';
      if (window.lucide) lucide.createIcons();
    };

    if (defaultAccountSelect) defaultAccountSelect.addEventListener('change', renderPreviewTable);

    const handleFile = (file) => {
      if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
        Toast.show('Please upload a valid .csv file', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        parsedRows = this.parseCSV(text);

        if (!parsedRows || parsedRows.length === 0) {
          Toast.show('No rows could be read from this CSV file', 'warning');
          return;
        }

        fileNameEl.textContent = file.name;
        renderPreviewTable();
      };
      reader.readAsText(file);
    };
  },

  parseCSV(text) {
    const lines = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    // Strip UTF-8 BOM and normalize newlines
    const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',' || char === ';' || char === '\t') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some(val => val.length > 0)) {
            lines.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(val => val.length > 0)) {
        lines.push(currentRow);
      }
    }

    if (lines.length === 0) return [];

    // Header normalization (lowercase, remove accents, symbols, parentheses)
    const normalizeStr = (str) => {
      return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[\s_\-"'\(\)€$]/g, '');
    };

    const headers = lines[0].map(h => normalizeStr(h));
    const rows = lines.slice(1);

    const getColIndex = (names) => {
      return headers.findIndex(h => names.some(n => h === n || h.includes(n)));
    };

    // Multi-language keyword dictionaries
    const dateIdx = getColIndex(['data', 'date', 'datum', 'fecha', 'valuta', 'time', 'day', 'giorno', 'zeit']);
    const descIdx = getColIndex(['dettagli', 'dettaglio', 'details', 'descrizione', 'description', 'causale', 'note', 'memo', 'verwendungszweck', 'concept', 'payee', 'beneficiario', 'ordinante', 'name', 'text', 'testo']);
    const refIdx = getColIndex(['riferimento', 'reference', 'ref', 'transazione', 'movimento']);
    const typeIdx = getColIndex(['tipo', 'type', 'typ', 'segno', 'kind', 'movementtype', 'tipologia']);
    const amtIdx = getColIndex(['importo', 'amount', 'betrag', 'montant', 'monto', 'valore', 'value', 'sum', 'total', 'totale', 'entrate', 'uscite', 'dare', 'avere', 'price']);
    const acctIdx = getColIndex(['account', 'konto', 'wallet', 'bank', 'banca', 'carta', 'card', 'conto']);
    const catIdx = getColIndex(['category', 'kategorie', 'cat', 'categoria', 'rubrica']);

    const normalizeDate = (raw) => {
      if (!raw) return new Date().toISOString().split('T')[0];
      const s = String(raw).trim();
      const dmyMatch = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
      if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }
      const ymdMatch = s.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
      if (ymdMatch) {
        return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
      }
      return s;
    };

    // Category smart auto-matcher from description
    const suggestCategory = (desc, type) => {
      const lower = (desc || '').toLowerCase();
      if (!lower) return '';

      // Match against existing categories in dashboard
      for (const cat of this.categories) {
        if (lower.includes(cat.name.toLowerCase())) {
          return cat.name;
        }
      }

      // Keyword based suggestions
      if (/lidl|coop|conad|carrefour|esselunga|aldi|penny|rewe|edeka|supermarket|mensa|food|restaurant|pizzeria|bar|sushi|burger|cafe|bakery|grocer/i.test(lower)) {
        const found = this.categories.find(c => /food|grocer|dine|dining|essen|aliment/i.test(c.name));
        if (found) return found.name;
      }
      if (/iliad|tim|vodafone|wind|enel|a2a|hera|bolletta|internet|wi-fi|wifi|telecom|phone|electric|strom|gas|utility|utilities/i.test(lower)) {
        const found = this.categories.find(c => /util|bill|bollett|strom/i.test(c.name));
        if (found) return found.name;
      }
      if (/klarna|amazon|zalando|ebay|paypal|store|shop|boutique|shein|asos|acquisto/i.test(lower)) {
        const found = this.categories.find(c => /shop|einkauf/i.test(c.name));
        if (found) return found.name;
      }
      if (/uber|taxi|trenitalia|italo|bus|metro|atm|flixbus|benzina|eni|q8|ip|esso|fuel|tanken|parking|autostrada|pedaggio|ticket/i.test(lower)) {
        const found = this.categories.find(c => /transport|auto|verkehr/i.test(c.name));
        if (found) return found.name;
      }
      if (/netflix|spotify|cinema|prime|disney|steam|playstation|apple|nintendo|game|movie|theatre/i.test(lower)) {
        const found = this.categories.find(c => /entertain|unterhalt/i.test(c.name));
        if (found) return found.name;
      }
      if (/farmacia|pharmacy|apotheke|doctor|medico|arzt|dentist|hospital|health|sanit/i.test(lower)) {
        const found = this.categories.find(c => /health|gesundheit|medic/i.test(c.name));
        if (found) return found.name;
      }
      if (/affitto|rent|miete|mutuo|mortgage|condominio|housing|house|wohnung/i.test(lower)) {
        const found = this.categories.find(c => /hous|rent|wohnen/i.test(c.name));
        if (found) return found.name;
      }
      if (/ricarica|stipendio|salary|gehalt|payroll|bonifico da|rimborso|refund|erstattung/i.test(lower)) {
        const found = this.categories.find(c => /salary|income|gehalt|freelance/i.test(c.name));
        if (found) return found.name;
      }

      return '';
    };

    // Account smart auto-matcher
    const suggestAccount = (desc) => {
      const lower = (desc || '').toLowerCase();
      if (!lower) return '';
      for (const acct of this.accounts) {
        if (lower.includes(acct.name.toLowerCase())) {
          return acct.name;
        }
      }
      if (/visa|mastercard|carta|credit/i.test(lower)) {
        const found = this.accounts.find(a => /card|credit|visa|master/i.test(a.name) || a.type === 'credit');
        if (found) return found.name;
      }
      if (/cash|contanti|bargeld/i.test(lower)) {
        const found = this.accounts.find(a => /cash|contant|bar/i.test(a.name) || a.type === 'cash');
        if (found) return found.name;
      }
      if (/savings|risparmio|sparbuch/i.test(lower)) {
        const found = this.accounts.find(a => /saving|risparm|spar/i.test(a.name) || a.type === 'savings');
        if (found) return found.name;
      }
      return '';
    };

    return rows.map((row, index) => {
      const dateVal = normalizeDate(dateIdx !== -1 ? row[dateIdx] : '');

      let rawAmt = amtIdx !== -1 ? row[amtIdx] : '0';
      rawAmt = String(rawAmt).replace(/[€$£\s]/g, '');
      const isNegative = rawAmt.includes('-') || (rawAmt.startsWith('(') && rawAmt.endsWith(')'));
      rawAmt = rawAmt.replace(/[\(\)\-]/g, '');

      // Normalize decimal separator
      if (rawAmt.includes(',') && !rawAmt.includes('.')) {
        rawAmt = rawAmt.replace(',', '.');
      } else if (rawAmt.includes('.') && rawAmt.includes(',')) {
        rawAmt = rawAmt.replace(/\./g, '').replace(',', '.');
      }
      const numAmt = parseFloat(rawAmt) || 0;

      // Extract Description & Reference
      const mainDesc = descIdx !== -1 && row[descIdx] ? row[descIdx].trim() : '';
      const refVal = refIdx !== -1 && row[refIdx] && refIdx !== descIdx ? row[refIdx].trim() : '';
      let combinedNote = mainDesc;
      if (refVal && !combinedNote.includes(refVal)) {
        combinedNote = combinedNote ? `${combinedNote} [Ref: ${refVal}]` : `Ref: ${refVal}`;
      }

      // Determine Type (Multi-Language)
      let rawType = typeIdx !== -1 && row[typeIdx] ? normalizeStr(row[typeIdx]) : '';
      let typeVal = 'expense';

      const incomeKeywords = ['entrata', 'entrate', 'accredito', 'accrediti', 'income', 'einnahme', 'credit', 'cr', 'deposit', 'rimborso', 'restituzione', 'ingreso', 'abono', 'revenu'];
      const transferKeywords = ['trasferimento', 'giroconto', 'transfer', 'umbuchung', 'virement', 'transferencia'];
      const expenseKeywords = ['uscita', 'uscite', 'addebito', 'addebiti', 'expense', 'ausgabe', 'debit', 'dr', 'withdrawal', 'spesa', 'pagamento', 'gasto', 'cargo', 'depense'];

      if (incomeKeywords.some(k => rawType === k || rawType.includes(k))) {
        typeVal = 'income';
      } else if (transferKeywords.some(k => rawType === k || rawType.includes(k))) {
        typeVal = 'transfer';
      } else if (expenseKeywords.some(k => rawType === k || rawType.includes(k))) {
        typeVal = 'expense';
      } else {
        if (isNegative) {
          typeVal = 'expense';
        } else if (/rimborso|ricarica|salary|stipendio/i.test(combinedNote)) {
          typeVal = 'income';
        } else {
          typeVal = 'expense';
        }
      }

      const explicitAcct = acctIdx !== -1 && row[acctIdx] ? row[acctIdx].trim() : '';
      const acctVal = explicitAcct || suggestAccount(combinedNote);

      const explicitCat = catIdx !== -1 && row[catIdx] ? row[catIdx].trim() : '';
      const catVal = explicitCat || suggestCategory(combinedNote, typeVal);

      return {
        rowIndex: index + 1,
        date: dateVal,
        account_name: acctVal,
        category_name: catVal,
        type: typeVal,
        amount: Math.abs(numAmt),
        note: combinedNote,
        isValid: Math.abs(numAmt) > 0
      };
    });
  }
};

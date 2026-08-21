const Modal = {
  backdropEl: null,
  boxEl: null,

  init() {
    this.backdropEl = document.getElementById('modal-backdrop');
    this.boxEl = document.getElementById('modal-container');

    if (this.backdropEl) {
      this.backdropEl.addEventListener('click', (e) => {
        if (e.target === this.backdropEl) this.close();
      });
    }
  },

  open({ title, contentHTML, onSave, saveText = 'Save', size = 'default' }) {
    if (!this.backdropEl) this.init();

    this.boxEl.className = 'modal-box' + (size === 'lg' || size === 'large' ? ' modal-lg' : '');

    this.boxEl.innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="icon-btn" id="modal-close-btn">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body">
        ${contentHTML}
      </div>
      <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
        <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="modal-save-btn">${saveText}</button>
      </div>
    `;

    this.backdropEl.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();

    document.getElementById('modal-close-btn').addEventListener('click', () => this.close());
    document.getElementById('modal-cancel-btn').addEventListener('click', () => this.close());

    document.getElementById('modal-save-btn').addEventListener('click', async () => {
      const btn = document.getElementById('modal-save-btn');
      btn.disabled = true;
      btn.innerText = 'Saving...';
      try {
        const success = await onSave();
        if (success !== false) {
          this.close();
        }
      } catch (err) {
        Toast.show(err.message || 'Action failed', 'danger');
      } finally {
        btn.disabled = false;
        btn.innerText = saveText;
      }
    });
  },

  close() {
    if (this.backdropEl) {
      this.backdropEl.classList.add('hidden');
    }
    if (this.boxEl) {
      this.boxEl.className = 'modal-box';
    }
  }
};

# AI Agent Instructions & Project Rules

> **CRITICAL**: Read and strictly adhere to these rules on **EVERY** task, file edit, or page implementation.

---

## 1. MANDATORY: Update Related Documentation After EVERY Change
Whenever any code, UI, backend route, schema, or styling is modified or created, you **MUST immediately update the corresponding markdown documentation files in `docs/`**:

- **Page Changes (`public/js/pages/`)**:
  - `dashboard.js`, `transactions.js`, `budget.js`, `accounts.js`, `goals.js`, `deadlines.js` -> Update `docs/pages-reference-part1.md`
  - `needs.js`, `debts.js`, `analytics.js`, `recurring.js`, `notifications.js` -> Update `docs/pages-reference-part2.md`
- **Backend / API / DB Changes (`server/`)**:
  - Update `docs/backend-reference.md` and `docs/architecture.md`
- **Core Frontend / Router / Components (`public/js/app.js`, `api.js`, `components/`)**:
  - Update `docs/frontend-core-reference.md`
- **CSS / Theme Changes (`public/css/styles.css`)**:
  - Update `docs/styles-reference.md`
- **New Guidelines or Project Rules**:
  - Update `docs/rules-and-conventions.md` and this file (`GEMINI.md`).

---

## 2. STRICT Code & UI Rules

### A. Zero Emoji Policy in UI Code
- **NEVER use raw emojis** anywhere in the main SPA UI or code.
- Always use **Lucide icons** instead: `<i data-lucide="icon-name"></i>`.
- Whenever inserting dynamic HTML into the DOM, always re-initialize icons:
  ```javascript
  if (window.lucide) lucide.createIcons();
  ```
*(Note: `login.html` is the only standalone exception).*

### B. Euro Currency Formatting Only
- All currency representations must use Euro (`€`) formatted with German `de-DE` locale:
  ```javascript
  // Example: €1.234,56
  '€' + Math.abs(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ```
- Modal labels: use `(€)` or `(EUR)`.
- Never use `$`, `USD`, or other symbols.

### C. Dual Backend Synchronization
- **Both backends must remain 100% in sync:**
  - Node.js: `server/index.js` & `server/db.js`
  - Python: `server/api_handler.py`, `server/app.py` & `server/db.py`
- Any new API endpoint, query parameter, calculation logic, or DB migration added to Node must be mirrored identically in Python.

---

## 3. Page Module Architecture Pattern

All page modules in `public/js/pages/` must follow the consistent single-page app pattern:

```javascript
const ExamplePage = {
  items: [],

  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Loading...</div>`;
    try {
      // 1. Fetch data
      const data = await API.get('/api/example');
      this.items = data || [];

      // 2. Render HTML
      container.innerHTML = `...`;

      // 3. Render icons & attach listeners
      if (window.lucide) lucide.createIcons();
      this.attachEvents(container);
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load: ${err.message}</div>`;
    }
  },

  attachEvents(container) {
    // Event delegation on container
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.action-btn');
      if (btn) {
        // handle action
      }
    });
  }
};
```

---

## 4. Standard UI Components

- **Modals**: Use `Modal.open({ title, contentHTML, onSave: async () => { ... } })`
- **Notifications**: Use `Toast.show(message, 'success' | 'warning' | 'danger' | 'info')`
- **API Calls**: Use `API.get()`, `API.post()`, `API.put()`, `API.delete()`

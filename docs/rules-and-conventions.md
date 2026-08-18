# Rules & Conventions

> **Purpose**: Mandatory rules and conventions for ALL changes to this codebase.
> Last updated: 2026-08-18

---

## STRICT Rules

### 1. Zero Emoji Policy
**NEVER use any emoji anywhere in the main app UI or code.**
- Use Lucide icons (`<i data-lucide="icon-name"></i>`) instead
- After any dynamic innerHTML, call `if (window.lucide) lucide.createIcons();`
- The login.html page is an exception (separate page, not part of main SPA)
- Last verified: 0 emojis across entire `public/` directory (excluding login.html)

### 2. Euro Currency Only
**ALL monetary values must use Euro (EUR) with German de-DE locale formatting.**
- Use `window.formatCurrency(val)` (defined in api.js) or the equivalent local helper
- Format: `€1.234,56` (dot for thousands, comma for decimals)
- Modal input labels: always `Amount (EUR)` or similar with EUR
- Never use `$`, `USD`, or any other currency symbol

### 3. Dual Backend Sync
**Both server/index.js (Node) and server/api_handler.py (Python) MUST stay in sync.**
- Any new endpoint added to one MUST be added to the other
- Any schema change in db.js MUST be mirrored in db.py
- Same SQL queries, same business logic, same response format

### 4. Architecture Doc Updates
**After EVERY set of changes, update the architecture.md and relevant reference docs.**
- Located at: `C:\Users\moein\.gemini\antigravity\brain\b77de5e1-6d87-4618-9937-7d20fa40b3ac\architecture.md`
- This is the single source of truth for future agents
- Update relevant sections: file tree, DB schema, API endpoints, cross-connections, etc.

---

## Coding Patterns

### Page Module Pattern
Every page follows this structure:
```javascript
const PageName = {
  // state properties
  items: [],

  async render(container) {
    // 1. Show loading spinner
    // 2. Fetch data from API
    // 3. Set container.innerHTML
    // 4. Call lucide.createIcons()
    // 5. Render charts if any
    // 6. Call this.attachEvents(container)
  },

  attachEvents(container) {
    // Bind all event listeners
    // Use delegated click on container for dynamic elements
  },

  openSomeModal(item = null) {
    Modal.open({
      title: item ? 'Edit' : 'Create',
      contentHTML: `<form>...</form>`,
      onSave: async () => {
        // Validate
        // API call
        // Toast.show('Success', 'success')
        // Re-render page
        return true; // close modal
      }
    });
  }
};
```

### Modal Pattern
```javascript
Modal.open({
  title: 'Title',
  saveText: 'Save',     // optional, default 'Save'
  contentHTML: `...`,    // HTML form markup
  onSave: async () => {  // async handler
    // Read form values
    // Validate (return false to keep modal open)
    // Make API call
    // Show toast
    // Re-render page
    return true;         // close modal
  }
});
```

### Toast Pattern
```javascript
Toast.show('Message', 'success');  // success | warning | danger | info
```

### API Pattern
```javascript
const data = await API.get('/api/endpoint');
const result = await API.post('/api/endpoint', { key: value });
await API.put('/api/endpoint/' + id, { key: value });
await API.delete('/api/endpoint/' + id);
```

### Currency Formatting
```javascript
// Global helper (preferred):
window.formatCurrency(1234.56)  // returns '€1.234,56'

// Local helper (used in some pages):
const formatCurrency = (val) => {
  const num = parseFloat(val || 0);
  return (num < 0 ? '-' : '') + '€' + Math.abs(num).toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
};
```

### Cross-Page Navigation
```html
<a href="#pagename">Link Text</a>
```
The hash router in app.js handles it automatically.

### Icon Usage
```html
<i data-lucide="icon-name"></i>
```
Always call `lucide.createIcons()` after dynamic innerHTML changes.

### Event Delegation Pattern
For dynamically rendered elements, use delegated click on the container:
```javascript
container.addEventListener('click', async (e) => {
  const btn = e.target.closest('.my-btn');
  if (btn) {
    const id = btn.dataset.id;
    // handle click
  }
});
```

---

## File Naming & Location

| Type | Location | Pattern |
|---|---|---|
| Page modules | `public/js/pages/` | `pagename.js` |
| Components | `public/js/components/` | `componentname.js` |
| API client | `public/js/api.js` | Single file |
| Router | `public/js/app.js` | Single file |
| Styles | `public/css/styles.css` | Single file |
| HTML shell | `public/index.html` | SPA shell |
| Auth page | `public/login.html` | Self-contained |
| Node backend | `server/index.js` | Express routes |
| Node schema | `server/db.js` | SQLite setup |
| Python backend | `server/api_handler.py` | Route handlers |
| Python schema | `server/db.py` | SQLite setup |
| Python entry | `server/app.py` | HTTP server |

---

## Common Lucide Icon Names Used

| Icon | Usage |
|---|---|
| wallet | App logo |
| layout-dashboard | Dashboard nav |
| arrow-left-right | Transactions nav |
| pie-chart | Budget nav |
| landmark | Accounts nav + bank icon |
| target | Goals nav |
| calendar-clock | Deadlines nav + deadline icon |
| calculator | Needs nav |
| credit-card | Debts nav + debt icon |
| line-chart | Analytics nav |
| repeat | Recurring nav + subscription icon |
| bell | Notifications nav |
| plus | Add buttons |
| edit-2 | Edit buttons |
| trash-2 | Delete buttons |
| check-circle / check-circle-2 | Complete/success |
| alert-circle | Error/danger |
| alert-triangle | Warning |
| info | Information |
| zap | Due today badge |
| sparkles | Auto-detected section |
| hand-coins | Personal loan icon |
| sun / moon | Theme toggle |
| log-out | Logout button |
| menu | Mobile menu |
| x | Close button |

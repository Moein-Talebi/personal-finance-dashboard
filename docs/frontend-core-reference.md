# Frontend Core Reference

> **Purpose**: Complete reference for all frontend core files. Use this instead of reading source files.
> Last updated: 2026-08-18

---

## 1. index.html (171 lines)

**Path**: `public/index.html`

Single-Page Application shell for the authenticated dashboard. Provides the HTML structure, library loads, layout containers, sidebar navigation, top bar, dynamic page mount point, modal shell, and toast container.

### External Libraries Loaded
- **Google Fonts**: `Outfit` (300-800) and `Plus Jakarta Sans` (300-700)
- **Lucide Icons**: `https://unpkg.com/lucide@latest`
- **Chart.js**: `https://cdn.jsdelivr.net/npm/chart.js`
- **Styles**: `/css/styles.css`

### Script Loading Order (Lines 149-167)
1. `/js/api.js`
2. `/js/components/toast.js`
3. `/js/components/modal.js`
4. `/js/pages/dashboard.js`
5. `/js/pages/transactions.js`
6. `/js/pages/budget.js`
7. `/js/pages/accounts.js`
8. `/js/pages/goals.js`
9. `/js/pages/deadlines.js`
10. `/js/pages/needs.js`
11. `/js/pages/debts.js`
12. `/js/pages/analytics.js`
13. `/js/pages/recurring.js`
14. `/js/pages/notifications.js`
15. `/js/app.js` (main router, loaded last)

### DOM Structure
```
<body data-theme="light">
  <div class="app-layout">
    <aside class="sidebar" id="sidebar">
      .sidebar-header -> .logo-icon -> <i data-lucide="wallet">
      <nav class="sidebar-nav"> (11 navigation links):
        #dashboard  -> layout-dashboard icon
        #transactions -> arrow-left-right icon
        #budget -> pie-chart icon
        #accounts -> landmark icon
        #goals -> target icon
        #deadlines -> calendar-clock icon
        #needs -> calculator icon
        #debts -> credit-card icon
        #analytics -> line-chart icon
        #recurring -> repeat icon
        #notifications -> bell icon + <span id="unread-notif-badge">
      .sidebar-footer:
        .user-pill -> #user-avatar (MT) + #user-name (Moein Talebi)
        #logout-btn
        .theme-switch-container:
          #theme-light-btn (sun icon)
          #theme-dark-btn (moon icon)
          .theme-slider
    <main class="main-wrapper">
      <header class="topbar">
        .topbar-left:
          #mobile-menu-toggle (menu icon, mobile-only)
          #page-title (h1)
          #page-subtitle
        .topbar-right:
          #global-add-tx-btn (plus icon, "Add Transaction")
          notification bell link -> #header-notif-dot
      <div id="page-content" class="page-container"> (Dynamic mount)
  <div id="modal-backdrop" class="modal-backdrop hidden">
    <div id="modal-container" class="modal-box">
  <div id="toast-container" class="toast-container">
```

### All DOM IDs
`sidebar`, `unread-notif-badge`, `user-pill`, `user-avatar`, `user-name`, `logout-btn`, `theme-light-btn`, `theme-dark-btn`, `mobile-menu-toggle`, `page-title`, `page-subtitle`, `global-add-tx-btn`, `header-notif-dot`, `page-content`, `modal-backdrop`, `modal-container`, `toast-container`

---

## 2. login.html (139 lines)

**Path**: `public/login.html`

Self-contained glassmorphism authentication page. Validates credentials against hardcoded constants.

### Hardcoded Credentials
```javascript
CREDS = {
  email: 'Moein.talebi82@gmail.com',
  password: '2235133',
  name: 'Moein Talebi',
  initials: 'MT'
}
```

### Authentication Flow
1. User submits form with email and password
2. 900ms simulated delay for UX
3. On success: sets `localStorage.auth_token = 'authenticated'` and `localStorage.auth_user = JSON.stringify({name, email, initials})`, redirects to `/index.html`
4. On failure: shows error message with shake animation

### DOM Elements
- `.auth-bg` with 4 animated `.orb` elements and `.grid-overlay`
- `.auth-card` containing logo, heading, form (`#login-form`), inputs (`#login-email`, `#login-password`), submit button (`#signin-btn`), error display (`#error-msg`, `#error-text`), password toggle (`#toggle-pw-btn`)

### Event Listeners
- Password toggle click: switches input type text/password
- Form submit: validates, shows spinner, authenticates
- Email/password input: clears error message

### NOTE: login.html still has emojis
- Logo uses `&#x1F4B6;` emoji
- Heading has `👋` emoji
- Password toggle uses `👁`/`🙈` emojis
- These are on the login page only (separate from main app)

---

## 3. api.js (46 lines)

**Path**: `public/js/api.js`

### Global Exports
- `const API` - REST client object
- `window.formatCurrency(val)` - Euro currency formatter

### API Methods
```javascript
API.get(endpoint, params = {})
// Builds URL with query params, fetch GET, returns parsed JSON
// Throws Error('HTTP Error: ' + status) on non-ok response

API.post(endpoint, data = {})
// fetch POST with JSON body, returns parsed JSON

API.put(endpoint, data = {})
// fetch PUT with JSON body, returns parsed JSON

API.delete(endpoint)
// fetch DELETE, returns parsed JSON
```

### formatCurrency Implementation
```javascript
window.formatCurrency = function(val) {
  const num = parseFloat(val || 0);
  return (num < 0 ? '-' : '') + '€' +
    Math.abs(num).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
};
```
Examples: `€1.250,00`, `-€50,00`

---

## 4. app.js (183 lines)

**Path**: `public/js/app.js`

Application entry point, router, auth guard, theme switcher, and notification poller.

### Auth Guard (Lines 4-25)
- Reads `localStorage.auth_token`. If missing or not `'authenticated'`, redirects to `/login.html`
- Reads `localStorage.auth_user` JSON, updates `#user-name` and `#user-avatar`
- `#logout-btn` click: clears localStorage, redirects to `/login.html`

### Configuration Maps
```javascript
pageTitleMap = {
  dashboard: 'Dashboard', transactions: 'Transactions', budget: 'Budgets',
  accounts: 'Wallet', goals: 'Goals', deadlines: 'Deadlines',
  needs: 'Needs Calculator', debts: 'Debts', analytics: 'Analytics',
  recurring: 'Recurring', notifications: 'Notifications'
}

pagesMap = {
  dashboard: DashboardPage, transactions: TransactionsPage, budget: BudgetPage,
  accounts: AccountsPage, goals: GoalsPage, deadlines: DeadlinesPage,
  needs: NeedsCalculatorPage, debts: DebtTrackerPage, analytics: AnalyticsPage,
  recurring: RecurringPage, notifications: NotificationsPage
}
```

### Theme Switching (Lines 44-66)
- `updateThemeUI(theme)`: toggles `active` class between light/dark buttons
- Light button click: `document.body.dataset.theme = 'light'`, stores in localStorage
- Dark button click: `document.body.dataset.theme = 'dark'`, stores in localStorage
- On load: reads `localStorage.theme` (default `'light'`)

### Hash Router (Lines 96-130)
```javascript
async function navigateTo(pageName) {
  // Resolves page from pagesMap (fallback: 'dashboard')
  // Updates sidebar .nav-item .active class
  // Updates #page-title text
  // Closes mobile sidebar
  // Calls pageObj.render(pageContainer)
  // Calls lucide.createIcons()
}

function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);
}
window.addEventListener('hashchange', handleHashChange);
handleHashChange(); // initial load
```

### Mobile Menu Toggle (Lines 136-140)
- `#mobile-menu-toggle` click: toggles `open` class on `#sidebar`

### Global Add Transaction (Lines 143-153)
- `#global-add-tx-btn` click:
  1. Fetches accounts and categories via `Promise.all`
  2. Assigns to `TransactionsPage.accounts` and `TransactionsPage.categories`
  3. Calls `TransactionsPage.openAddModal()`

### Notification Polling (Lines 156-176)
```javascript
async function updateNotificationBadges() {
  // GET /api/notifications
  // Count unread (n.read === false)
  // Update #unread-notif-badge text and visibility
  // Update #header-notif-dot hidden class
}
window.updateNotificationBadges = updateNotificationBadges;
updateNotificationBadges(); // initial call
setInterval(updateNotificationBadges, 15000); // every 15 seconds
```

---

## 5. modal.js (65 lines)

**Path**: `public/js/components/modal.js`

### Global Export: `const Modal`

### Properties
- `Modal.backdropEl` (null) - cached `#modal-backdrop`
- `Modal.boxEl` (null) - cached `#modal-container`

### Methods
```javascript
Modal.init()
// Caches backdrop and box DOM refs
// Attaches backdrop click-to-close listener

Modal.open({ title, contentHTML, onSave, saveText = 'Save' })
// Injects header (title + close btn), body (contentHTML), footer (Cancel + Save)
// Shows backdrop (removes .hidden)
// Calls lucide.createIcons()
// Save button: disables, shows 'Saving...', calls await onSave()
//   If onSave() returns !== false: calls this.close()
//   On error: Toast.show(err.message, 'danger')
//   Finally: re-enables button

Modal.close()
// Adds .hidden to backdrop
```

### Injected DOM IDs
`#modal-close-btn`, `#modal-cancel-btn`, `#modal-save-btn`

---

## 6. toast.js (29 lines)

**Path**: `public/js/components/toast.js`

### Global Export: `const Toast`

### Methods
```javascript
Toast.show(message, type = 'info', duration = 3000)
// Types: 'info', 'success', 'danger', 'warning'
// Icon mapping:
//   success -> check-circle
//   danger -> alert-circle
//   warning -> alert-triangle
//   info -> info
// Creates <div class="toast {type}"> with icon + message
// Appends to #toast-container
// Calls lucide.createIcons()
// After {duration}ms: fades out (opacity 0, 300ms transition)
// After fade: removes element from DOM
```

---

## Cross-File Connections Summary

| File | Depends On | Depended On By |
|---|---|---|
| `index.html` | All CSS and JS files | Everything (SPA shell) |
| `login.html` | None (self-contained) | `app.js` (auth redirect) |
| `api.js` | None | All page modules, `app.js` |
| `app.js` | `api.js`, all page modules | `index.html` (bootstrap) |
| `modal.js` | `toast.js`, `lucide` | All page modules |
| `toast.js` | `lucide` | `modal.js`, all page modules |

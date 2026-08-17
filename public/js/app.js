document.addEventListener('DOMContentLoaded', () => {

  // ─── Auth Guard ──────────────────────────────────────────────────────────────
  const authToken = localStorage.getItem('auth_token');
  if (!authToken || authToken !== 'authenticated') {
    window.location.href = '/login.html';
    return;
  }

  // Load user info from localStorage
  const userData = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const userNameEl  = document.getElementById('user-name');
  const userAvatarEl = document.getElementById('user-avatar');
  if (userNameEl && userData.name)     userNameEl.innerText     = userData.name;
  if (userAvatarEl && userData.initials) userAvatarEl.innerText = userData.initials;

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login.html';
    });
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const pageContainer = document.getElementById('page-content');
  const pageTitleEl = document.getElementById('page-title');
  const navItems = document.querySelectorAll('.nav-item');
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const globalAddTxBtn = document.getElementById('global-add-tx-btn');
  
  // Theme elements
  const lightBtn = document.getElementById('theme-light-btn');
  const darkBtn = document.getElementById('theme-dark-btn');

  // Initialize theme from localStorage or default to light
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', currentTheme);
  updateThemeUI(currentTheme);

  function updateThemeUI(theme) {
    if (theme === 'dark') {
      lightBtn.classList.remove('active');
      darkBtn.classList.add('active');
    } else {
      darkBtn.classList.remove('active');
      lightBtn.classList.add('active');
    }
  }

  if (lightBtn && darkBtn) {
    lightBtn.addEventListener('click', () => {
      document.body.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      updateThemeUI('light');
    });

    darkBtn.addEventListener('click', () => {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      updateThemeUI('dark');
    });
  }

  const pageTitleMap = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    budget: 'Budgets',
    accounts: 'Wallet',
    goals: 'Goals',
    deadlines: 'Deadlines',
    needs: 'Needs Calculator',
    debts: 'Debts',
    analytics: 'Analytics',
    recurring: 'Recurring',
    notifications: 'Notifications'
  };

  const pagesMap = {
    dashboard: DashboardPage,
    transactions: TransactionsPage,
    budget: BudgetPage,
    accounts: AccountsPage,
    goals: GoalsPage,
    deadlines: DeadlinesPage,
    needs: NeedsCalculatorPage,
    debts: DebtTrackerPage,
    analytics: AnalyticsPage,
    recurring: RecurringPage,
    notifications: NotificationsPage
  };

  async function navigateTo(pageName) {
    const targetPage = pagesMap[pageName] ? pageName : 'dashboard';
    
    // Update Nav
    navItems.forEach(item => {
      if (item.getAttribute('data-page') === targetPage) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Header Title
    if (pageTitleEl) {
      pageTitleEl.innerText = pageTitleMap[targetPage] || 'Dashboard';
    }

    // Close mobile menu if open
    if (sidebar) sidebar.classList.remove('open');

    // Render Page
    const pageObj = pagesMap[targetPage];
    if (pageObj && pageObj.render) {
      await pageObj.render(pageContainer);
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  // Handle Hash Router
  function handleHashChange() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
  }

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange(); // initial page load

  // Mobile menu toggle
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Global Add Transaction Button
  if (globalAddTxBtn) {
    globalAddTxBtn.addEventListener('click', () => {
      TransactionsPage.accounts = [];
      TransactionsPage.categories = [];
      Promise.all([API.get('/api/accounts'), API.get('/api/categories')]).then(([accts, cats]) => {
        TransactionsPage.accounts = accts;
        TransactionsPage.categories = cats;
        TransactionsPage.openAddModal();
      });
    });
  }

  // Poll Notifications for Badge Update
  async function updateNotificationBadges() {
    try {
      const notifs = await API.get('/api/notifications');
      const unreadCount = notifs.filter(n => !n.read).length;
      
      const navBadge = document.getElementById('unread-notif-badge');
      const headerDot = document.getElementById('header-notif-dot');

      if (navBadge) {
        navBadge.innerText = unreadCount;
        navBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
      }

      if (headerDot) {
        if (unreadCount > 0) headerDot.classList.remove('hidden');
        else headerDot.classList.add('hidden');
      }
    } catch (e) {
      // silent catch
    }
  }

  window.updateNotificationBadges = updateNotificationBadges;
  updateNotificationBadges();
  setInterval(updateNotificationBadges, 15000);
});


const NotificationsPage = {
  notifications: [],

  async render(container) {
    container.innerHTML = `<div class="loading-spinner">Loading notifications...</div>`;

    try {
      this.notifications = await API.get('/api/notifications');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:700;">Alerts & Notifications</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Budget warnings, bill due dates, and milestone alerts</p>
          </div>

          <button class="btn btn-secondary" id="mark-all-read-btn">
            <i data-lucide="check-check"></i> Mark All as Read
          </button>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.85rem;">
          ${this.notifications.length === 0 ? '<div class="card" style="color:var(--text-muted);">No notifications</div>' : this.notifications.map(n => {
            let icon = 'bell';
            let color = 'var(--color-info)';
            if (n.type === 'alert') { icon = 'alert-triangle'; color = 'var(--color-danger)'; }
            if (n.type === 'bill') { icon = 'calendar'; color = 'var(--color-warning)'; }
            if (n.type === 'milestone') { icon = 'award'; color = 'var(--color-success)'; }

            return `
              <div class="card" style="display:flex; align-items:flex-start; gap:1rem; padding:1.1rem; border-left: 4px solid ${color}; opacity:${n.read ? 0.7 : 1};">
                <div style="width:38px; height:38px; border-radius:var(--radius-md); background:${color}22; color:${color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <i data-lucide="${icon}"></i>
                </div>

                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                    <h4 style="font-size:0.95rem; font-weight:700;">${n.title}</h4>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${n.created_at || 'Just now'}</span>
                  </div>
                  <p style="font-size:0.88rem; color:var(--text-secondary);">${n.message}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      if (window.lucide) lucide.createIcons();
      this.attachEvents(container);

    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load notifications: ${err.message}</div>`;
    }
  },

  attachEvents(container) {
    document.getElementById('mark-all-read-btn').addEventListener('click', async () => {
      await API.post('/api/notifications/read-all');
      Toast.show('All notifications marked as read', 'success');
      this.render(container);
      if (window.updateNotificationBadges) window.updateNotificationBadges();
    });
  }
};

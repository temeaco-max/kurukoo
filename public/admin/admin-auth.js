(() => {
  const nativeFetch = window.fetch.bind(window);
  const adminToken = () => window.localStorage.getItem('kurukoo_admin') || '';

  window.fetch = async (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input || '');
    const url = new URL(rawUrl, window.location.origin);
    if (!url.pathname.startsWith('/api/admin/')) return nativeFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
    const token = adminToken();
    if (token) headers.set('x-admin-token', token);

    const response = await nativeFetch(input, {
      ...init,
      headers,
      credentials: init.credentials || 'same-origin',
    });

    if ((response.status === 401 || response.status === 403) && !/\/admin\/login(?:\.html)?$/.test(window.location.pathname)) {
      window.localStorage.removeItem('kurukoo_admin');
      window.location.assign('/admin/login.html');
    }
    return response;
  };

  const isLogin = /\/admin\/login(?:\.html)?$/.test(window.location.pathname);
  if (isLogin || document.documentElement.dataset.adminShell === 'true') return;

  const inject = () => {
    document.documentElement.dataset.adminShell = 'true';
    if (!document.getElementById('kurukoo-admin-convergence-css')) {
      const link = document.createElement('link');
      link.id = 'kurukoo-admin-convergence-css';
      link.rel = 'stylesheet';
      link.href = '/css/admin-pages/admin-convergence-shell.css';
      document.head.appendChild(link);
    }

    const path = window.location.pathname + window.location.search;
    const current = (href) => path === href || (href !== '/admin/' && path.startsWith(href));
    const links = [
      ['/admin/', 'Control Room'],
      ['/admin/?section=conversations', 'Conversations'],
      ['/admin/?section=providers', 'Providers'],
      ['/admin/?section=economic', 'Economic'],
      ['/admin/?section=moderation', 'Moderation'],
      ['/admin/?section=compliance', 'Compliance'],
      ['/admin/?section=notifications', 'Notifications'],
      ['/admin/?section=connectors', 'Integrations'],
      ['/admin/ai-agents.html', 'Agents'],
      ['/admin/analytics.html', 'Analytics'],
      ['/admin/revenue.html', 'Revenue'],
      ['/admin/marketing.html', 'Marketing'],
      ['/admin/ads.html', 'Advertising'],
      ['/admin/content.html', 'Content'],
      ['/admin/curation.html', 'Curation'],
      ['/admin/?section=settings', 'Settings'],
      ['/admin/?section=seo', 'SEO'],
    ];

    const bar = document.createElement('aside');
    bar.className = 'kurukoo-admin-convergence-bar';
    bar.setAttribute('aria-label', 'Kurukoo admin control plane');
    bar.innerHTML = `
      <div class="kurukoo-admin-convergence-brand">
        <a href="/admin/" aria-label="Kurukoo Admin Control Room">
          <img src="/assets/brand/logo-icon.png" alt="" width="28" height="28">
          <span>Kurukoo Admin</span>
        </a>
        <span class="kurukoo-admin-convergence-state"><span aria-hidden="true"></span> <span data-admin-health-label>Checking platform</span></span>
      </div>
      <nav class="kurukoo-admin-convergence-nav" aria-label="Admin modules">
        ${links.map(([href, label]) => `<a href="${href}"${current(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <div class="kurukoo-admin-convergence-actions">
        <span class="kurukoo-admin-convergence-state" data-admin-operational-label>Loading operational state</span>
        <a href="/" target="_blank" rel="noopener">Open site</a>
        <button type="button" data-admin-convergence-logout>Sign out</button>
      </div>`;

    document.body.prepend(bar);
    document.querySelector('[data-admin-convergence-logout]')?.addEventListener('click', () => {
      window.localStorage.removeItem('kurukoo_admin');
      window.location.assign('/admin/login.html');
    });

    const authHeaders = { Accept: 'application/json' };
    void Promise.all([
      fetch('/api/admin/platform/overview', { headers: authHeaders }).then(response => response.json().catch(() => ({}))),
      fetch('/api/admin/platform/health', { headers: authHeaders }).then(response => response.json().catch(() => ({}))),
    ]).then(([overview, health]) => {
      const healthLabel = document.querySelector('[data-admin-health-label]');
      const operationalLabel = document.querySelector('[data-admin-operational-label]');
      if (!overview?.success && !health?.success) {
        if (healthLabel) healthLabel.textContent = 'Platform state unavailable';
        if (operationalLabel) operationalLabel.textContent = 'Operational state unavailable';
        return;
      }
      const operational = Array.isArray(overview?.integrations?.operational) ? overview.integrations.operational : [];
      const ready = operational.filter(item => item?.runtimeReady === true).length;
      const configured = operational.filter(item => item?.configured === true).length;
      const devices = Number(overview?.fcm?.registeredDevices || 0);
      const activation = Number(overview?.readinessSummary?.activation_required || 0);
      const device = Number(overview?.readinessSummary?.device_required || 0);
      const healthy = health?.healthy !== false && health?.status !== 'degraded';
      if (healthLabel) healthLabel.textContent = healthy && activation === 0 && device === 0 ? 'Platform healthy' : 'Platform needs attention';
      if (operationalLabel) operationalLabel.textContent = `Operational ${ready}/${operational.length} · Configured ${configured} · FCM devices ${devices}`;
    }).catch(() => {
      const healthLabel = document.querySelector('[data-admin-health-label]');
      const operationalLabel = document.querySelector('[data-admin-operational-label]');
      if (healthLabel) healthLabel.textContent = 'Platform state unavailable';
      if (operationalLabel) operationalLabel.textContent = 'Operational state unavailable';
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });
  else inject();
})();

//# sourceURL=kurukoo-admin-auth.js

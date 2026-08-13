(() => {
  const path = window.location.pathname;
  if (/\/admin\/(?:login(?:\.html)?)?$/.test(path)) return;
  const links = [
    ['Control room', '/admin/dashboard.html', 'overview'], ['Analytics', '/admin/analytics.html', 'analytics'], ['Users & providers', '/admin/users.html', 'users'], ['AI agents', '/admin/ai-agents.html', 'agents'], ['Skill flows', '/admin/skill-flows.html', 'flows'], ['Content CMS', '/admin/content.html', 'content'], ['SEO console', '/admin/seo.html', 'seo'], ['Control plane', '/admin/settings.html', 'settings'], ['Pilot observability', '/admin/pilot', 'pilot'], ['Supply registry', '/admin/supply.html', 'supply'], ['Referrals', '/admin/referrals.html', 'referrals'], ['Partnerships', '/admin/partnerships.html', 'partners'], ['Safety & reports', '/admin/scam.html', 'safety'], ['Pricing & revenue', '/admin/pricing.html', 'pricing'], ['Commissions', '/admin/commissions.html', 'commissions'], ['Social scheduler', '/admin/social.html', 'social'], ['Roadmap', '/admin/future.html', 'roadmap']
  ];
  const active = href => path === href || (href === '/admin/dashboard.html' && /\/admin\/?$/.test(path));
  const icon = name => ({ overview:'◌', analytics:'⌁', users:'◎', agents:'✦', flows:'↳', content:'▤', seo:'⌕', settings:'⚙', pilot:'◈', supply:'◇', referrals:'↗', partners:'◫', safety:'△', pricing:'₦', commissions:'%', social:'◷', roadmap:'→' }[name] || '•');
  const sidebar = document.createElement('aside'); sidebar.className = 'admin-shell-sidebar'; sidebar.setAttribute('aria-label', 'Admin navigation');
  sidebar.innerHTML = `<a class="admin-shell-brand" href="/admin/dashboard.html" aria-label="Kurukoo Control Room"><span class="admin-shell-mark" aria-hidden="true">◒</span><span><strong>Kurukoo</strong><small>Control room</small></span></a><nav>${links.map(([label, href, name]) => `<a class="admin-shell-link${active(href) ? ' is-active' : ''}" href="${href}"><span aria-hidden="true">${icon(name)}</span><span>${label}</span></a>`).join('')}</nav><div class="admin-shell-foot"><a href="/" target="_blank" rel="noopener">View live app ↗</a></div>`;
  const topbar = document.createElement('header'); topbar.className = 'admin-shell-topbar'; topbar.innerHTML = `<button class="admin-shell-menu" type="button" aria-expanded="false" aria-controls="admin-shell-nav">Menu</button><div class="admin-shell-title"><span>Kurukoo operating system</span><strong>Control room</strong></div><div class="admin-shell-actions"><button class="admin-shell-drawer-toggle" type="button" aria-expanded="false" aria-controls="admin-stats-drawer">Signals</button></div>`;
  const drawer = document.createElement('aside'); drawer.id = 'admin-stats-drawer'; drawer.className = 'admin-stats-drawer'; drawer.hidden = true; drawer.innerHTML = `<div class="admin-drawer-header"><div><p class="admin-kicker">Live operating summary</p><h2>Signals</h2></div><button type="button" class="admin-drawer-close" aria-label="Close signals">×</button></div><div class="admin-drawer-grid"><div><span>Requests</span><strong id="admin-drawer-requests">—</strong></div><div><span>Unread notifications</span><strong id="admin-drawer-notifications">—</strong></div><div><span>Agent runtime</span><strong id="admin-drawer-agent">—</strong></div><div><span>Voice</span><strong id="admin-drawer-voice">—</strong></div></div><p class="admin-drawer-note">These are operational signals, not payment, fulfilment, or external-delivery proof.</p>`;
  document.body.prepend(drawer); document.body.prepend(topbar); document.body.prepend(sidebar); document.body.classList.add('admin-shell-enabled'); document.body.classList.add(`admin-page-${(path.split('/').pop() || 'dashboard').replace(/\.html$/,'').replace(/[^a-z0-9_-]/gi,'') || 'dashboard'}`);
  const toggle = topbar.querySelector('.admin-shell-menu'); const setNav = open => { document.body.classList.toggle('admin-nav-open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setNav(!document.body.classList.contains('admin-nav-open')));
  const drawerToggle = topbar.querySelector('.admin-shell-drawer-toggle'); const closeDrawer = drawer.querySelector('.admin-drawer-close'); const setDrawer = open => { drawer.hidden = !open; drawerToggle.setAttribute('aria-expanded', String(open)); };
  drawerToggle.addEventListener('click', () => setDrawer(drawer.hidden)); closeDrawer.addEventListener('click', () => setDrawer(false));
  const token = localStorage.getItem('kurukoo_admin') || localStorage.getItem('kurukoo_admin_token');
  if (token) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const rawUrl = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(rawUrl, window.location.origin);
      if (!url.pathname.startsWith('/api/admin') && !url.pathname.startsWith('/api/supply-registry/admin')) return nativeFetch(input, init);
      const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      if (!headers.has('Accept')) headers.set('Accept', 'application/json');
      return nativeFetch(input, { ...init, headers, credentials: 'same-origin' });
    };
    Promise.all([fetch('/api/admin/stats').then(r => r.ok ? r.json() : null), fetch('/api/admin/control-plane').then(r => r.ok ? r.json() : null), fetch('/api/voice/status').then(r => r.ok ? r.json() : null)]).then(([stats, controls, voice]) => { const requestTotal = Object.values(stats?.economic_requests || {}).reduce((sum, value) => sum + Number(value || 0), 0); document.querySelector('#admin-drawer-requests').textContent = String(requestTotal || 0); document.querySelector('#admin-drawer-notifications').textContent = String(stats?.unread_internal_notifications ?? 0); const agent = controls?.controlPlane?.controls?.find(item => item.key === 'agent_enabled'); document.querySelector('#admin-drawer-agent').textContent = agent?.value === 'true' ? 'Enabled' : 'Disabled'; document.querySelector('#admin-drawer-voice').textContent = voice?.voice?.available ? 'Available' : 'Unavailable'; }).catch(() => {});
  }
})();

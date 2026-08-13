(() => {
  'use strict';
  if (window.__kurukooAdminBrandBridge) return;
  window.__kurukooAdminBrandBridge = true;

  const token = localStorage.getItem('kurukoo_admin');
  if (!token) { window.location.assign('/admin/login'); return; }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = new URL(rawUrl, window.location.origin);
    if (!url.pathname.startsWith('/api/admin') && !url.pathname.startsWith('/api/supply-registry/admin')) return originalFetch(input, init);
    const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined));
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    return originalFetch(input, { ...init, headers, credentials: 'same-origin' });
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.admin-workbench-header, .admin-rail')) return;
    document.body.classList.add('admin-legacy-branded');
    const bar = document.createElement('header');
    bar.className = 'admin-connected-bar';
    bar.setAttribute('data-admin-brand-shell', 'true');
    const brand = document.createElement('a');
    brand.className = 'admin-workbench-brand'; brand.href = '/admin/dashboard.html';
    const logo = document.createElement('img'); logo.src = '/assets/brand/logo-icon.svg'; logo.alt = ''; logo.width = 28; logo.height = 28;
    const name = document.createElement('span'); name.innerHTML = 'Kurukoo <strong>Admin</strong>';
    brand.append(logo, name);
    const nav = document.createElement('nav'); nav.className = 'admin-workbench-nav'; nav.setAttribute('aria-label', 'Connected admin navigation');
    const entries = [['Control room', '/admin/dashboard.html'], ['Operations', '/admin/operations.html'], ['Content', '/admin/content.html'], ['SEO', '/admin/seo.html'], ['People', '/admin/users.html'], ['Agents', '/admin/ai-agents.html'], ['Commercial', '/admin/revenue.html']];
    for (const [label, href] of entries) { const link = document.createElement('a'); link.href = href; link.textContent = label; if (window.location.pathname === href) { link.className = 'is-current'; link.setAttribute('aria-current', 'page'); } nav.append(link); }
    const signOut = document.createElement('button'); signOut.type = 'button'; signOut.className = 'admin-button admin-button--secondary'; signOut.textContent = 'Sign out'; signOut.addEventListener('click', () => { localStorage.removeItem('kurukoo_admin'); window.location.assign('/admin/login'); });
    bar.append(brand, nav, signOut); document.body.prepend(bar);
  });
})();

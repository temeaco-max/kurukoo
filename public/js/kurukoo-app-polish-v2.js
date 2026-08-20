(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;

  const loadStyle = () => {
    if (document.querySelector('link[data-kurukoo-app-polish]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/kurukoo-app-polish.css?v=1';
    link.dataset.kurukooAppPolish = '';
    document.head.appendChild(link);
  };

  const path = () => window.location.pathname.replace(/\/+$/, '') || '/';
  const canonical = new Map([
    ['/discover', '/app/discover'],
    ['/daily-picks', '/app/discover#today'],
    ['/requests', '/app/requests'],
    ['/tasks', '/app/tasks'],
    ['/connect', '/app/connect'],
    ['/cart', '/app/cart'],
    ['/wallet', '/app/wallet'],
    ['/points', '/app/points'],
    ['/top-up', '/app/top-up'],
    ['/subscription', '/app/subscriptions'],
    ['/memory', '/app/memory'],
    ['/safety', '/app/safety'],
    ['/call', '/app/call'],
    ['/confirmation', '/app/confirmations']
  ]);

  function normalizeInternalLinks() {
    document.querySelectorAll('.k-app-main a[href], .k-app-header a[href]').forEach((el) => {
      const anchor = el;
      const raw = anchor.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('http')) return;
      const [pathname, suffix = ''] = raw.split('#');
      const replacement = canonical.get(pathname);
      if (replacement && raw === pathname) anchor.setAttribute('href', replacement);
      else if (replacement && !raw.startsWith('/app/')) anchor.setAttribute('href', replacement + (suffix ? `#${suffix}` : ''));
    });
  }

  function markCurrentNavigation() {
    const current = path();
    document.querySelectorAll('.k-app-nav a, .k-mobile-tabbar a').forEach((link) => {
      let href = '';
      try { href = new URL(link.href, window.location.origin).pathname.replace(/\/+$/, '') || '/'; } catch { return; }
      const selected = href === current;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function addAccountShortcut() {
    const header = document.querySelector('.k-app-header-actions');
    if (!header || header.querySelector('[data-kurukoo-profile-link]')) return;
    const identity = header.querySelector('.k-app-identity');
    if (!identity) return;
    const a = document.createElement('a');
    a.href = '/settings';
    a.className = 'k-app-profile-link k-app-card-action';
    a.dataset.kurukooProfileLink = '';
    a.setAttribute('aria-label', 'Open account settings');
    a.textContent = 'Account';
    header.insertBefore(a, identity);
  }

  function addDiscoverQuickActions() {
    if (currentSection() !== 'discover') return;
    const title = document.querySelector('.k-app-title-row');
    if (!title || document.querySelector('[data-discover-quick-actions]')) return;
    const nav = document.createElement('nav');
    nav.className = 'k-app-quick-actions';
    nav.dataset.discoverQuickActions = '';
    nav.setAttribute('aria-label', 'Discover shortcuts');
    const items = [
      ['Today', '#today'], ['Nearby', '#nearby'], ['Topics', '/app/topics'],
      ['Opportunities', '/app/opportunities'], ['Products', '#products'], ['Ask Kurukoo', '/chat']
    ];
    items.forEach(([label, href], index) => {
      const a = document.createElement('a');
      a.href = href;
      a.className = `k-app-quick-action${index === items.length - 1 ? ' primary' : ''}`;
      a.textContent = label;
      nav.appendChild(a);
    });
    title.insertAdjacentElement('afterend', nav);
  }

  function refineStatus() {
    const row = document.querySelector('.k-app-status-row');
    if (!row || row.dataset.polished === 'true') return;
    const statuses = [...row.querySelectorAll('.k-status')];
    if (statuses[0]) statuses[0].textContent = 'Core Kurukoo online';
    if (statuses[1]) {
      const count = statuses[1].textContent?.match(/\d+/)?.[0] || '';
      statuses[1].textContent = count ? `Web surfaces · ${count}` : 'Web surfaces';
    }
    if (statuses[2]) {
      const match = (statuses[2].textContent || '').match(/(\d+)\/(\d+)/);
      statuses[2].textContent = match ? `Connections active · ${match[1]}/${match[2]}` : 'Connections';
    }
    row.dataset.polished = 'true';
  }

  function enhanceActions() {
    document.querySelectorAll('.k-app-card-action').forEach((el) => {
      if (el instanceof HTMLButtonElement || el.getAttribute('role') === 'button') {
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent?.trim() || 'Action');
      }
    });
  }

  function currentSection() {
    const match = window.location.pathname.match(/^\/app\/([^/?#]+)/);
    return match?.[1] || 'agent';
  }

  function pass() {
    loadStyle();
    normalizeInternalLinks();
    markCurrentNavigation();
    addAccountShortcut();
    refineStatus();
    addDiscoverQuickActions();
    enhanceActions();
  }

  const boot = () => {
    pass();
    window.requestAnimationFrame(pass);
    window.setTimeout(pass, 150);
    const main = document.querySelector('.k-app-main');
    if (main) {
      const observer = new MutationObserver(() => window.requestAnimationFrame(pass));
      observer.observe(main, { childList: true, subtree: true });
      window.setTimeout(() => observer.disconnect(), 2500);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

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

  const currentPath = () => {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    return pathname;
  };

  const markCurrentNavigation = () => {
    const path = currentPath();
    const links = document.querySelectorAll('.k-app-nav a, .k-mobile-tabbar a');
    links.forEach((link) => {
      let href;
      try { href = new URL(link.href, window.location.origin).pathname.replace(/\/+$/, '') || '/'; } catch { return; }
      const exact = href === path;
      const sectionMatch = href.startsWith('/app/') && path.startsWith('/app/') && href === path;
      const isCurrent = exact || sectionMatch;
      link.classList.toggle('active', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else if (!link.hasAttribute('aria-current') || link.getAttribute('aria-current') === 'page') link.setAttribute('aria-current', 'false');
    });
  };

  const refineIdentity = () => {
    const header = document.querySelector('.k-app-header-actions');
    if (!header || header.querySelector('[data-kurukoo-profile-link]')) return;
    const identity = header.querySelector('.k-app-identity');
    if (!identity) return;
    const settings = document.createElement('a');
    settings.href = '/settings';
    settings.className = 'k-app-card-action k-app-profile-link';
    settings.dataset.kurukooProfileLink = '';
    settings.textContent = 'Account';
    settings.setAttribute('aria-label', 'Open account settings');
    header.insertBefore(settings, header.firstChild === identity ? header.firstChild : header.lastChild);
  };

  const refineStatus = () => {
    const row = document.querySelector('.k-app-status-row');
    if (!row) return;
    const statuses = [...row.querySelectorAll('.k-status')];
    if (statuses[0]) statuses[0].textContent = 'Core Kurukoo online';
    if (statuses[1]) {
      const count = statuses[1].textContent?.match(/\d+/)?.[0] || '';
      statuses[1].textContent = count ? `Web surfaces · ${count}` : 'Web surfaces';
    }
    if (statuses[2]) {
      const text = statuses[2].textContent || '';
      const match = text.match(/(\d+)\/(\d+)/);
      statuses[2].textContent = match ? `Connections active · ${match[1]}/${match[2]}` : 'Connections';
    }
  };

  const enhanceDiscover = () => {
    if (!location.pathname.endsWith('/app/discover')) return;
    const main = document.querySelector('.k-app-main .k-app-container');
    if (!main || main.querySelector('[data-discover-quick-actions]')) return;
    const title = main.querySelector('.k-app-title-row');
    if (!title) return;
    const actions = document.createElement('nav');
    actions.className = 'k-app-quick-actions';
    actions.dataset.discoverQuickActions = '';
    actions.setAttribute('aria-label', 'Discover shortcuts');
    const items = [
      ['Today', '/app/discover#today'],
      ['Nearby', '/app/discover#nearby'],
      ['Topics', '/app/topics'],
      ['Opportunities', '/app/opportunities'],
      ['Products', '/app/discover#products'],
      ['Ask Kurukoo', '/chat']
    ];
    items.forEach(([label, href], index) => {
      const a = document.createElement('a');
      a.href = href;
      a.className = index === items.length - 1 ? 'k-app-quick-action primary' : 'k-app-quick-action';
      a.textContent = label;
      actions.appendChild(a);
    });
    title.insertAdjacentElement('afterend', actions);
  };

  const enhanceActionTargets = () => {
    document.querySelectorAll('.k-app-card-action').forEach((el) => {
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') el.setAttribute('aria-label', el.textContent?.trim() || 'Action');
    });
  };

  const boot = () => {
    loadStyle();
    markCurrentNavigation();
    refineIdentity();
    refineStatus();
    enhanceDiscover();
    enhanceActionTargets();
    window.requestAnimationFrame(markCurrentNavigation);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

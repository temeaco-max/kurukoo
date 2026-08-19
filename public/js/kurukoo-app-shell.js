(() => {
  const path = window.location.pathname || '/';
  const routes = [
    { label: 'Agent', href: '/chat', icon: 'chat' },
    { label: 'Discover', href: '/discover', icon: 'discover' },
    { label: 'Requests', href: '/requests', icon: 'request' },
    { label: 'Tasks', href: '/tasks', icon: 'work' },
    { label: 'Connect', href: '/connect', icon: 'settings' },
  ];

  const current = (href) => path === href || (href !== '/chat' && path.startsWith(`${href}/`));

  const createTabBar = () => {
    if (document.querySelector('.k-mobile-tabbar')) return;
    const nav = document.createElement('nav');
    nav.className = 'k-mobile-tabbar';
    nav.setAttribute('aria-label', 'Kurukoo app navigation');
    for (const route of routes) {
      const link = document.createElement('a');
      link.href = route.href;
      link.setAttribute('aria-label', route.label);
      if (current(route.href)) link.setAttribute('aria-current', 'page');
      link.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><use href="/icons/kurukoo-icons.svg#${route.icon}"></use></svg><span>${route.label}</span>`;
      nav.appendChild(link);
    }
    document.body.appendChild(nav);
  };

  const loadFoundation = () => {
    if (document.querySelector('link[data-kurukoo-client-foundation]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/kurukoo-client-foundation.css';
    link.dataset.kurukooClientFoundation = 'true';
    document.head.appendChild(link);
  };

  const boot = () => {
    loadFoundation();
    if (document.body.classList.contains('workspace-page')) createTabBar();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

(() => {
  const loadPublicVisuals = () => {
    if (!document.body?.classList.contains('k-public-page')) return;
    if (!document.querySelector('link[data-kurukoo-os-public]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/kurukoo-visual-system.css';
      link.dataset.kurukooOsPublic = '';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-kurukoo-desktop-final]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/kurukoo-desktop-final.css?v=1';
      link.dataset.kurukooDesktopFinal = '';
      document.head.appendChild(link);
    }
  };

  const toggle = document.getElementById('mobile-toggle-btn');
  const nav = document.getElementById('main-nav-links');
  const overlay = document.getElementById('mobile-nav-overlay');
  const close = () => { nav?.classList.remove('active'); toggle?.setAttribute('aria-expanded', 'false'); overlay?.classList.remove('active'); if (overlay) overlay.hidden = true; document.body.classList.remove('mobile-nav-open'); };
  const open = () => { nav?.classList.add('active'); toggle?.setAttribute('aria-expanded', 'true'); if (overlay) overlay.hidden = false; overlay?.classList.add('active'); document.body.classList.add('mobile-nav-open'); };

  const hydrateAuthenticatedHeader = async () => {
    const account = document.getElementById('nav-user-btn');
    const label = account?.querySelector('.nav-user-label');
    if (!account || !label) return;
    try {
      const response = await fetch('/api/auth/identity/me', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload?.success || !payload?.identity) return;
      account.classList.remove('is-logged-out');
      account.classList.add('is-logged-in');
      account.href = '/desk';
      account.title = 'Open your Kurukoo desk';
      account.setAttribute('aria-label', 'Open your Kurukoo desk');
      label.textContent = 'Open desk';
    } catch {
      // Anonymous public browsing remains the default; no auth claim is made on failure.
    }
  };

  loadPublicVisuals();
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.contains('active') ? close() : open());
    overlay?.addEventListener('click', close);
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { if (window.innerWidth <= 992) close(); }));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 992) close(); });
  }
  void hydrateAuthenticatedHeader();
})();

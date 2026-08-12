(() => {
  const toggle = document.getElementById('mobile-toggle-btn');
  const nav = document.getElementById('main-nav-links');
  const overlay = document.getElementById('mobile-nav-overlay');
  if (!toggle || !nav) return;
  const close = () => { nav.classList.remove('active'); toggle.setAttribute('aria-expanded', 'false'); overlay?.classList.remove('active'); if (overlay) overlay.hidden = true; document.body.classList.remove('mobile-nav-open'); };
  const open = () => { nav.classList.add('active'); toggle.setAttribute('aria-expanded', 'true'); if (overlay) overlay.hidden = false; overlay?.classList.add('active'); document.body.classList.add('mobile-nav-open'); };
  toggle.addEventListener('click', () => nav.classList.contains('active') ? close() : open());
  overlay?.addEventListener('click', close);
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { if (window.innerWidth <= 992) close(); }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 992) close(); });
})();

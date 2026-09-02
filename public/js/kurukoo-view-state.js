(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  if (window.KurukooViewState) return;

  const ROUTES = Object.freeze({
    chat: '/chat', home: '/home', explore: '/explore', activity: '/activity', work: '/tasks',
    connect: '/connect', reminders: '/reminders', saved: '/saved', notifications: '/notifications', memory: '/memory',
    topics: '/topics', opportunities: '/opportunities', capabilities: '/capabilities', agents: '/agents',
    wallet: '/wallet', points: '/points', subscriptions: '/subscriptions', cart: '/cart',
    'top-up': '/top-up', checkout: '/checkout', prayer: '/prayer', call: '/call', safety: '/safety', settings: '/settings',
    files: '/artifacts'
  });

  const SECTION_BY_PATH = Object.freeze({
    '/chat': 'chat',
    '/home': 'home', '/desk': 'home',
    '/explore': 'explore', '/discover': 'explore',
    '/activity': 'activity', '/requests': 'activity',
    '/tasks': 'work',
    '/connect': 'connect', '/reminders': 'reminders', '/saved': 'saved', '/notifications': 'notifications', '/memory': 'memory',
    '/topics': 'topics', '/opportunities': 'opportunities', '/capabilities': 'capabilities', '/agents': 'agents',
    '/wallet': 'wallet', '/points': 'points', '/subscriptions': 'subscriptions', '/cart': 'cart',
    '/top-up': 'top-up', '/checkout': 'checkout', '/confirmations': 'activity', '/prayer': 'prayer',
    '/call': 'call', '/safety': 'safety', '/settings': 'settings', '/artifacts': 'files'
  });

  const INTERNAL_SECTION = Object.freeze({
    chat: 'chat', home: 'desk', explore: 'discover', activity: 'requests', work: 'tasks', files: 'artifacts'
  });

  const canonicalPath = (section) => ROUTES[section] || ROUTES[Object.keys(INTERNAL_SECTION).find(key => INTERNAL_SECTION[key] === section)] || `/${section}`;

  const pathToSection = (pathname) => {
    const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
    return SECTION_BY_PATH[normalized] || (normalized.startsWith('/app/') ? normalized.split('/')[2] || 'home' : 'home');
  };

  const parseLocation = (url) => {
    const params = new URLSearchParams(url.search);
    const section = pathToSection(url.pathname);
    return Object.freeze({
      section,
      internalSection: INTERNAL_SECTION[section] || section,
      pathname: url.pathname,
      canonicalPath: canonicalPath(section),
      query: url.search,
      hash: url.hash,
      conversationId: params.get('conversationId') || '',
      contextId: params.get('contextId') || '',
      objectId: params.get('objectId') || '',
      action: params.get('action') || '',
      params
    });
  };

  const buildUrl = (next = {}) => {
    const url = new URL(window.location.href);
    if (next.section && ROUTES[next.section]) url.pathname = ROUTES[next.section];
    if (next.internalSection) {
      const key = Object.keys(INTERNAL_SECTION).find(item => INTERNAL_SECTION[item] === next.internalSection);
      if (key) url.pathname = canonicalPath(key);
    }
    if (next.pathname) url.pathname = next.pathname;
    if (next.query !== undefined) url.search = next.query;
    if (next.hash !== undefined) url.hash = next.hash;
    ['conversationId', 'contextId', 'objectId', 'action'].forEach((key) => {
      if (next[key] === undefined) return;
      if (next[key]) url.searchParams.set(key, String(next[key])); else url.searchParams.delete(key);
    });
    return url;
  };

  let state = parseLocation(new URL(window.location.href));
  const listeners = new Set();
  const emit = () => {
    document.documentElement.dataset.kurukooView = state.section;
    document.body.dataset.viewSection = state.section;
    document.body.dataset.viewInternalSection = state.internalSection;
    document.body.dataset.viewContext = state.contextId || '';
    document.body.dataset.viewCanonicalPath = state.canonicalPath;
    listeners.forEach((listener) => { try { listener(state); } catch { /* observer isolation */ } });
  };

  const store = {
    getState: () => state,
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener); listener(state); return () => listeners.delete(listener);
    },
    set(next = {}, { history = 'push' } = {}) {
      const url = buildUrl(next);
      if (history === 'replace') window.history.replaceState({}, '', url.href);
      else window.history.pushState({}, '', url.href);
      state = parseLocation(url); emit(); return state;
    }
  };

  const router = {
    resolve: (next = {}) => buildUrl(next).href,
    navigate(next = {}, { replace = false } = {}) {
      const url = buildUrl(next);
      if (replace) window.location.replace(url.href); else window.location.assign(url.href);
    }
  };

  const setActiveNav = (nextState) => {
    document.querySelectorAll('.k-app-nav a[href], .k-mobile-tabbar a[href]').forEach((anchor) => {
      let pathname = '';
      try { pathname = new URL(anchor.href, window.location.href).pathname.replace(/\/+$/, '') || '/'; } catch { return; }
      const active = pathname === nextState.canonicalPath || pathname === nextState.pathname;
      anchor.classList.toggle('active', active);
      if (active) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current');
    });
  };

  window.KurukooViewState = Object.freeze({ ROUTES, store, router, parse: () => state });
  window.addEventListener('popstate', () => { state = parseLocation(new URL(window.location.href)); emit(); });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a[href]');
    if (!anchor || !anchor.closest('.k-app-shell') || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    try {
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname.startsWith('/admin') || destination.pathname === '/chat') return;
      state = parseLocation(destination);
      try { sessionStorage.setItem('kurukoo.last.view', JSON.stringify({ section: state.section, internalSection: state.internalSection, href: destination.href })); } catch { /* storage unavailable */ }
      emit();
    } catch { /* browser handles navigation */ }
  }, true);

  store.subscribe(setActiveNav);
  emit();
})();

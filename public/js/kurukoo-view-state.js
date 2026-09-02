(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  if (window.KurukooViewState) return;

  const ROUTES = Object.freeze({
    agent: '/chat', desk: '/desk', discover: '/discover', requests: '/requests', tasks: '/tasks', connect: '/connect',
    agents: '/agents', capabilities: '/capabilities', opportunities: '/opportunities', topics: '/topics',
    wallet: '/wallet', points: '/points', 'top-up': '/top-up', subscriptions: '/subscriptions', checkout: '/checkout',
    confirmations: '/confirmations', artifacts: '/artifacts', prayer: '/prayer', call: '/call', safety: '/safety',
    memory: '/memory', notifications: '/notifications', settings: '/settings', help: '/help', reminders: '/reminders',
    saved: '/saved', cart: '/cart'
  });

  const pathToSection = (pathname) => {
    const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
    const match = Object.entries(ROUTES).find(([, path]) => path === normalized);
    return match?.[0] || (normalized.startsWith('/app/') ? normalized.split('/')[2] || 'desk' : 'desk');
  };

  const parseLocation = (url) => {
    const params = new URLSearchParams(url.search);
    return Object.freeze({
      section: pathToSection(url.pathname), pathname: url.pathname, query: url.search, hash: url.hash,
      conversationId: params.get('conversationId') || '', contextId: params.get('contextId') || '',
      objectId: params.get('objectId') || '', action: params.get('action') || '', params
    });
  };

  const buildUrl = (next = {}) => {
    const url = new URL(window.location.href);
    if (next.section && ROUTES[next.section]) url.pathname = ROUTES[next.section];
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
    document.body.dataset.viewContext = state.contextId || '';
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
    document.querySelectorAll('.k-app-nav a[href], .k-app-more-menu a[href]').forEach((anchor) => {
      let pathname = '';
      try { pathname = new URL(anchor.href, window.location.href).pathname; } catch { return; }
      const active = pathname === ROUTES[nextState.section];
      anchor.classList.toggle('active', active);
      if (active) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current');
      if (active && anchor.closest('.k-app-more')) anchor.closest('.k-app-more').open = true;
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
      try { sessionStorage.setItem('kurukoo.last.view', JSON.stringify({ section: state.section, contextId: state.contextId, href: destination.href })); } catch { /* storage unavailable */ }
    } catch { /* browser handles navigation */ }
  }, true);

  store.subscribe(setActiveNav);
  emit();
})();

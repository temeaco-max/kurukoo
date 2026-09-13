(() => {
  const sectionByPath = {
    '/admin': 'overview',
    '/admin/': 'overview',
    '/admin/conversations': 'conversations',
    '/admin/providers': 'providers',
    '/admin/economic': 'economic',
    '/admin/moderation': 'moderation',
    '/admin/compliance': 'compliance',
    '/admin/notifications': 'notifications',
    '/admin/integrations': 'connectors',
    '/admin/settings': 'settings',
    '/admin/seo': 'seo',
  };
  const pathname = window.location.pathname;
  const section = sectionByPath[pathname];
  if (!section) return;
  const NativeURLSearchParams = window.URLSearchParams;
  window.URLSearchParams = function KurukooCanonicalURLSearchParams(init) {
    if ((init === window.location.search || init == null) && !window.location.search) return new NativeURLSearchParams(`section=${encodeURIComponent(section)}`);
    return new NativeURLSearchParams(init);
  };
  window.URLSearchParams.prototype = NativeURLSearchParams.prototype;
})();

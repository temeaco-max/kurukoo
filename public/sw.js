const STATIC_CACHE = 'kurukoo-static-v6';
const PAGES_CACHE = 'kurukoo-pages-v6';
const PWA_SHELL_CACHE = 'kurukoo-pwa-shell-v6';
const ALLOWED_CACHES = [STATIC_CACHE, PAGES_CACHE, PWA_SHELL_CACHE];

const SHELL_ASSETS = [
    '/chat',
    '/css/site.css',
    '/css/kurukoo-platform.css',
    '/css/kurukoo-chat.css',
    '/css/kurukoo-hub.css',
    '/js/kurukoo-primary-chat.js',
    '/js/kurukoo-workspace.js',
    '/js/site-navigation.js',
    '/manifest.json',
    '/sw.js',
    '/offline.html',
    '/assets/icons/icon-192.svg',
    '/assets/icons/icon-512.svg'
];

const PAGES_TO_CACHE = [
    '/', '/ng/', '/gh/', '/gb/', '/pricing', '/about', '/contact', '/help', '/blog',
    '/resources/', '/partners/', '/advertise/',
    '/api/hero-taglines'
];

self.addEventListener('install', event => {
    event.waitUntil(Promise.all([
        caches.open(PWA_SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {})),
        caches.open(PAGES_CACHE).then(cache => cache.addAll(PAGES_TO_CACHE.map(path => new Request(path, {cache:'reload'}))).catch(() => {}))
    ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => ALLOWED_CACHES.includes(key) ? undefined : caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/messages') || url.pathname.startsWith('/api/profile') || url.pathname.startsWith('/api/credits') || url.pathname.startsWith('/api/pulse') || url.pathname.startsWith('/api/orders') || url.pathname.startsWith('/api/chat') || url.pathname.startsWith('/webhook') || url.pathname.startsWith('/ussd')) return;

    const isStatic = url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/assets/') || url.pathname === '/manifest.json' || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('unpkg.com');
    if (isStatic) {
        event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
            if (response.ok) caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
            return response;
        }).catch(() => cached)));
        return;
    }

    const isPublicPage = request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html') || url.pathname.startsWith('/api/pricing') || url.pathname.startsWith('/api/blog') || url.pathname.startsWith('/api/hero-taglines');
    if (isPublicPage) {
        event.respondWith(caches.open(PAGES_CACHE).then(cache => cache.match(request).then(cached => {
            const network = fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => request.mode === 'navigate' ? caches.match('/offline.html') : cached);
            return cached || network;
        })));
    }
});

const STATIC_CACHE = 'kurukoo-static-v7';
const PAGES_CACHE = 'kurukoo-pages-v7';
const PWA_SHELL_CACHE = 'kurukoo-pwa-shell-v7';
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
    '/resources/', '/partners/', '/advertise/'
];
const CACHEABLE_PAGE_PATHS = new Set(PAGES_TO_CACHE);
const CACHEABLE_PUBLIC_APIS = new Set();

const isProtectedDynamicPath = pathname => pathname.startsWith('/admin')
    || pathname.startsWith('/api/messages')
    || pathname.startsWith('/api/profile')
    || pathname.startsWith('/api/credits')
    || pathname.startsWith('/api/pulse')
    || pathname.startsWith('/api/orders')
    || pathname.startsWith('/api/chat')
    || pathname.startsWith('/api/voice')
    || pathname.startsWith('/api/user')
    || pathname.startsWith('/api/reminders')
    || pathname.startsWith('/api/safety')
    || pathname.startsWith('/api/tasks')
    || pathname.startsWith('/api/points')
    || pathname.startsWith('/webhook')
    || pathname.startsWith('/ussd');

const isStaticAsset = url => url.pathname.startsWith('/css/')
    || url.pathname.startsWith('/js/')
    || url.pathname.startsWith('/assets/')
    || url.pathname === '/manifest.json'
    || url.hostname.includes('fonts.googleapis.com')
    || url.hostname.includes('fonts.gstatic.com')
    || url.hostname.includes('unpkg.com');

const isExplicitlyCacheablePublicRequest = (request, url) => url.origin === self.location.origin
    && (CACHEABLE_PAGE_PATHS.has(url.pathname) || CACHEABLE_PUBLIC_APIS.has(url.pathname));

self.addEventListener('install', event => {
    event.waitUntil(Promise.all([
        caches.open(PWA_SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {})),
        caches.open(PAGES_CACHE).then(cache => cache.addAll(PAGES_TO_CACHE.map(path => new Request(path, { cache: 'reload' }))).catch(() => {}))
    ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => ALLOWED_CACHES.includes(key) ? undefined : caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Never cache authenticated or mutable application data, including private media routes.
    if (isProtectedDynamicPath(url.pathname)) return;

    if (isStaticAsset(url)) {
        event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
            if (response.ok) caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
            return response;
        }).catch(() => cached)));
        return;
    }

    if (isExplicitlyCacheablePublicRequest(request, url)) {
        event.respondWith(caches.open(PAGES_CACHE).then(cache => cache.match(request).then(cached => {
            const network = fetch(request).then(response => {
                if (response.ok) cache.put(request, response.clone());
                return response;
            }).catch(() => request.mode === 'navigate' ? caches.match('/offline.html') : cached);
            return cached || network;
        })));
        return;
    }

    // Unknown navigations are never persisted. They may still show the truthful
    // offline shell when the network cannot satisfy an uncached route.
    if (request.mode === 'navigate') event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
});

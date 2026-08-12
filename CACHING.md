# Kurukoo v5.23.1 - Ecosystem-Wide Caching Strategy

This document details the complete end-to-end caching strategy implemented across the Kurukoo platform (public website, PWA shell, API layer, and Service Worker) to ensure instant, reliable, and low-data operation across low-bandwidth connections in Nigeria, Ghana, and the diaspora.

---

## 1. Service Worker Caching Architecture (`public/sw.js`)

The service worker maintains three distinct cache storage instances:

| Cache Name | Target Scope | Strategy | Expiry / Invalidation |
| :--- | :--- | :--- | :--- |
| `kurukoo-pwa-shell-v1` | `/dashboard.html`, `/sw.js`, `/manifest.json`, `/offline.html`, `/assets/icons/*` | Network-First with Offline Shell Fallback | Pre-cached on `install`. Invalidated on deploy version change. |
| `kurukoo-static-v1` | `/css/site.css`, `/js/kurukoo-primary-chat.js`, `/js/kurukoo-workspace.js`, `/js/site-navigation.js`, Fonts, Leaflet CDN | Cache-First (Network Fallback) | Served instantly from cache, updated on version query parameter change (`?v=1.0.0`). |
| `kurukoo-pages-v1` | HTML Pages (`/`, `/ng/`, `/gh/`, `/gb/`, `/pricing`, `/about`, `/help`, `/blog`) & Public APIs | Stale-While-Revalidate | Serves cached page instantly, fetches background update, updates cache for next visit. |

---

## 2. API Response Caching Policy

### 2.1 Public & Static APIs (Cached 5 Minutes)
Headers set: `Cache-Control: public, max-age=300, stale-while-revalidate=600`
- `GET /api/pricing/:country`
- `GET /api/blog`
- `GET /api/blog/:slug`
- `GET /api/hero-taglines`
- `GET /api/emergency`

### 2.2 User-Specific & Dynamic APIs (Never Cached)
Headers set: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
- `GET /api/messages`
- `POST /api/chat`
- `GET /api/dashboard`
- `GET /api/profile`
- `POST /api/credits/topup`
- `POST /api/pulse/activate`
- `POST /api/pulse/deactivate`
- `POST /api/rides/request`
- `POST /api/survey/response`
- `POST /api/order/finalize`
- ALL `/api/admin/*` endpoints
- `POST /webhook/whatsapp`
- `POST /ussd`

---

## 3. Cache Busting & Version Control

1. **Version Manifest**: Managed via `/public/version.json` (`{"version": "1.0.0"}`).
2. **Template Versioning**: All static asset URLs in `.ejs` templates and `dashboard.html` append `?v=1.0.0`.
3. **PWA Update Notification**: When a new service worker version is detected, a toast notification surfaces in the PWA: *"A new version is available. Refresh to update."* with a direct **Refresh** button.

---

## 4. Offline Fallback (`/public/offline.html`)

When a user is completely offline and navigates to an un-cached page, the service worker intercepts the request and serves the African Modernism styled `/offline.html` fallback card:
> *"You're offline. Don't worry—Kurukoo still works for the basics. Connect to the internet to use all features."*

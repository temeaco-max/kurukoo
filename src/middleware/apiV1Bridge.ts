/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import type { RequestHandler } from 'express';

/**
 * Versioned API compatibility bridge.
 *
 * The service routers still own their existing /api/* paths. This middleware
 * gives Web/PWA/native clients a stable /api/v1/* contract without duplicating
 * router registrations while the internal API taxonomy is being migrated.
 *
 * The original URL remains available through req.originalUrl for observability;
 * downstream Express routing sees the legacy /api/* path so the existing
 * canonical service owner handles the request.
 */
export const apiV1Bridge: RequestHandler = (req, res, next) => {
  const original = req.url || '/';
  const isV1 = original === '/api/v1' || original === '/api/v1/' || original.startsWith('/api/v1/');
  if (!isV1) return next();

  // Versioned-headers for observability; the original URL stays on req.originalUrl.
  res.setHeader('X-Kurukoo-Api-Version', 'v1');
  res.setHeader('X-Kurukoo-Api-Owner', 'legacy-service-router');

  // Routes with a native /api/v1 owner (mounted at /api/v1 downstream) keep
  // their versioned path; everything else bridges to the canonical /api/* owner.
  const V1_NATIVE_PREFIXES = ['/execution', '/credentials', '/cards', '/protections', '/audit'];
  const sub = original.slice('/api/v1'.length) || '/'; // '/chat/stream?…'
  const hasNativeOwner = V1_NATIVE_PREFIXES.some((prefix) => {
    if (!sub.startsWith(prefix)) return false;
    const nextChar = sub[prefix.length];
    return nextChar === undefined || nextChar === '/' || nextChar === '?';
  });
  if (hasNativeOwner) return next();

  // CRITICAL: this middleware must be mounted at the app root (no mount path).
  // Express restores req.url when a mount-scoped middleware layer exits, so a
  // rewrite performed inside app.use('/api/v1', …) never reaches downstream
  // routers. At the root there is no mount layer, so the rewrite persists.
  req.url = `/api${sub === '/' ? '' : sub}`;
  next();
};

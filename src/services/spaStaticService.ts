/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

/**
 * Ownership of the built SPA output.
 *
 * The React Router client is built by `npm run build:spa` into
 * `frontend/.output/public`, copied to `dist/spa` for production images, and
 * served from there. This module is the single owner of that boundary so no
 * other file guesses at build-output paths.
 *
 * Migration is deliberately incremental: a route is only served from the built
 * SPA once it is listed in `SPA_PILOT_ROUTES` and its parity has been proven.
 * Every other route keeps its existing owner.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Routes served from the prerendered SPA output in this slice.
 *
 * Each entry must have proven parity before being added. Adding a route here
 * is what makes the built client reachable for it; removing an EJS template is
 * a separate, later step.
 */
export const SPA_PILOT_ROUTES = ['/about', '/help', '/pricing', '/contact', '/careers', '/blog', '/api-docs', '/legal', '/how-it-works', '/partners', '/advertise', '/network', '/topics', '/resources'] as const;

export type SpaStaticBoundary = {
  /** Absolute path of the built SPA public directory, or null when not built. */
  publicDir: string | null;
  /** Whether the built output exists on disk. */
  available: boolean;
  /** Whether a given pathname is a proven SPA-served route. */
  serves: (pathname: string) => boolean;
};

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve the built SPA directory. Production reads `dist/spa` (populated by
 * `npm run copy:public`); development reads the raw build output so a rebuild
 * is visible without a copy step.
 */
export function resolveSpaPublicDir(root = process.cwd()): string | null {
  return firstExisting([
    path.join(root, 'dist', 'spa'),
    path.join(root, 'frontend', '.output', 'public'),
  ]);
}

export function getSpaStaticBoundary(root = process.cwd()): SpaStaticBoundary {
  const publicDir = resolveSpaPublicDir(root);
  const routes = new Set<string>(SPA_PILOT_ROUTES);
  return {
    publicDir,
    available: publicDir !== null,
    serves: (pathname: string) => routes.has(pathname.replace(/\/+$/, '') || '/'),
  };
}

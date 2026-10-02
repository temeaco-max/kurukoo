/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';
import type express from 'express';

/**
 * Canonical SPA serving for retired EJS marketing/content surfaces.
 *
 * Once a public path's content lives in the TanStack frontend, the backend
 * serves the production SPA shell for it under the same URL (no redirects):
 * - build artifact present → 200 shell, client hydrates the route;
 * - build absent → next() to Express default 404 (honest missing page, never
 *   a half-rendered legacy template).
 *
 * Legacy EJS fallbacks were removed per the frontend-convergence migration;
 * do not re-add res.render calls for paths listed in SPA_ROUTES files.
 */
const SHELL = path.join(process.cwd(), 'frontend', '.output', 'public', '_shell.html');

export function spaShellAvailable(): boolean {
  try {
    return fs.existsSync(SHELL);
  } catch {
    return false;
  }
}

/** Serve the SPA shell. Returns true when handled, false to fall through. */
export function serveSpaShell(_req: express.Request, res: express.Response): boolean {
  if (!spaShellAvailable()) return false;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-cache, must-revalidate');
  res.sendFile(SHELL);
  return true;
}

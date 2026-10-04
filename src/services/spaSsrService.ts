/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import type express from 'express';
import fs from 'fs';
import { resolveSpaPublicDir, spaDocumentFor } from './spaStaticService.js';
import path from 'path';
import { pathToFileURL } from 'url';

type FetchHandler = { fetch?: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response };

let modulePromise: Promise<FetchHandler> | null = null;

function serverBundlePath(): string {
  // Production images copy the build output to dist/spa-server; a local
  // checkout reads it straight from the frontend build directory.
  return [
    path.join(process.cwd(), 'dist', 'spa-server', 'index.mjs'),
    path.join(process.cwd(), 'frontend', '.output', 'server', 'index.mjs'),
  ].find((candidate) => fs.existsSync(candidate)) ?? path.join(process.cwd(), 'dist', 'spa-server', 'index.mjs');
}

export function spaServerBundleAvailable(): boolean {
  return fs.existsSync(serverBundlePath());
}

async function loadHandler(): Promise<FetchHandler> {
  if (!modulePromise) {
    modulePromise = import(/* webpackIgnore: true */ /* @vite-ignore */ pathToFileURL(serverBundlePath()).href).then(
      (m) => (m.default ?? m) as FetchHandler,
    );
  }
  return modulePromise;
}

/**
 * Server-rendered SPA fallback for dynamic detail routes (topics, resources,
 * provider profiles). The EJS templates for these were removed on the basis
 * that the SPA route modules own them; when the exact URL is not a
 * prerendered static file, render it through the Node server entry the
 * production build already emits instead of falling back to a static page.
 */
export async function renderSpaViaServerEntry(originalUrl: string): Promise<Response | null> {
  const handler = await loadHandler();
  if (!handler || typeof handler.fetch !== 'function') return null;
  const request = new Request(`http://kurukoo.local${originalUrl}`, { headers: { accept: 'text/html' } });
  const env = {};
  const ctx = { context: { waitUntil() {} }, waitUntil() {}, passThroughOnException() {}, props: {} };
  return (handler.fetch as (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response)(request, env, ctx);
}

/**
 * Express adapter: serves the SPA route for the current request through the
 * built Node server entry. Returns true when the response was written.
 */
export async function serveSpaRoute(req: express.Request, res: express.Response): Promise<boolean> {
  if (!spaServerBundleAvailable()) return false;
  try {
    const response = await renderSpaViaServerEntry(req.originalUrl);
    if (!response) return false;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return false;
    const body = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.send(body);
    return true;
  } catch (error) {
    console.error('[SPA SSR] detail route render failed:', error);
    return false;
  }
}

/**
 * Detail-route owner chain: prerendered document, then the built Node server
 * entry, then the caller's EJS fallback. The route handler keeps its 404 guard;
 * this only decides who renders the page when the item exists.
 */
export async function serveSpaDetail(req: express.Request, res: express.Response): Promise<boolean> {
  const document = spaDocumentFor(resolveSpaPublicDir(), req.path);
  if (document) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(document);
    return true;
  }
  return serveSpaRoute(req, res);
}

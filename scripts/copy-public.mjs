/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'fs';
import path from 'path';

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// The built SPA (prerendered pages + hashed client bundle) must reach dist/,
// otherwise the container ships no client bundle and the SPA cannot hydrate.
// It is copied to its own directory rather than over dist/public so the
// hand-written legacy shells in frontend/public are never overwritten.
const builtSpaSource = path.join('frontend', '.output', 'public');
if (!fs.existsSync(builtSpaSource)) {
  console.warn('[copy-public] frontend/.output/public is missing: the SPA was not built. Run `npm run build:spa` before copying.');
} else {
  copyRecursive(builtSpaSource, path.join('dist', 'spa'));
}

console.log('Copying static assets, views, and locales to dist...');
copyRecursive('frontend/public', 'dist/public');
copyRecursive('views', 'dist/views');
copyRecursive('locales', 'dist/locales');
console.log('Assets copied successfully.');

// The Node server entry the SPA build emits is required by the detail-surface
// SSR bridge (src/services/spaSsrService.ts): routes whose slug cannot be
// prerendered at build time are rendered through it at request time. Without
// this copy a production image serves prerendered routes only.
const builtSpaServerSource = path.join('frontend', '.output', 'server');
if (!fs.existsSync(builtSpaServerSource)) {
  console.warn('[copy-public] frontend/.output/server is missing: detail routes fall back to prerendered documents only. Run `npm run build:spa`.');
} else {
  copyRecursive(builtSpaServerSource, path.join('dist', 'spa-server'));
}

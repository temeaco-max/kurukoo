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

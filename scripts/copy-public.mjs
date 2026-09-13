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

console.log('Copying static assets, views, and locales to dist...');
copyRecursive('frontend/public', 'dist/public');
copyRecursive('views', 'dist/views');
copyRecursive('locales', 'dist/locales');
console.log('Assets copied successfully.');

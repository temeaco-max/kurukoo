/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimeRoots = [
  'views',
  'frontend/public/js',
  'frontend/public/css',
  'src/routes',
  'src/services',
  'src/services/canonicalPlatformFeatureRegistry.ts',
];
const allowedFiles = new Set([
  'src/routes/appSurfaceRoutes.ts',
  'src/services/canonicalUrlRegistry.ts',
  'src/services/platformFeatureVisualRegistry.ts',
  'src/services/canonicalPlatformFeatureRegistry.ts',
  'scripts/run-desktop-playwright-walkthrough.mjs',
  'scripts/test-web-app-flow.ts',
  'scripts/test-desktop-screen-flow.ts',
  'scripts/test-client-surface-coverage.ts',
]);

const files = [];
function walk(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) { files.push(relative); return; }
  for (const entry of fs.readdirSync(absolute)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    walk(path.join(relative, entry));
  }
}
for (const target of runtimeRoots) walk(target);

const findings = [];
const legacyPatterns = [
  /href\s*=\s*["']\/app\//i,
  /location\.(?:href|assign|replace)\s*\([^)]*["']\/app\//i,
  /window\.open\s*\([^)]*["']\/app\//i,
  /webSurface\s*:\s*["']\/app\//i,
  /route\s*:\s*["']\/app\//i,
  /["']\/admin\/\?section=/i,
];
for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  if (allowedFiles.has(normalized)) continue;
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const pattern of legacyPatterns) {
    if (pattern.test(content)) findings.push({ file: normalized, pattern: pattern.toString() });
  }
}

if (findings.length) {
  console.error('Canonical URL emission audit failed. Legacy product URLs were found outside approved compatibility/test owners:');
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.pattern}`);
  process.exit(1);
}

console.log(`Canonical URL emission audit passed: ${files.length} runtime files checked; legacy aliases remain confined to approved compatibility/test owners.`);

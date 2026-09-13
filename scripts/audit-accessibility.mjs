/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const extensions = new Set(['.ejs', '.html']);
const files = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (extensions.has(path.extname(entry.name))) files.push(file);
  }
}
walk(path.join(root, 'views'));
walk(path.join(root, 'frontend/public'));
const findings = [];
function add(file, rule, message, line) { findings.push({ file: path.relative(root, file), rule, message, line }); }
function hasAccessibleLabelHook(attrs) { return /\baria-label\s*=|\baria-labelledby\s*=|\bid\s*=/i.test(attrs); }
function isWrappedByLabel(scanLine, matchIndex, matchLength) {
  const before = scanLine.slice(0, matchIndex);
  const after = scanLine.slice(matchIndex + matchLength);
  const lastLabelOpen = before.lastIndexOf('<label');
  const lastLabelClose = before.lastIndexOf('</label>');
  return lastLabelOpen > lastLabelClose && after.includes('</label>');
}
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((lineText, index) => {
    const line = index + 1;
    // EJS expressions contain `%>`; remove expression bodies before scanning HTML attributes so the parser cannot terminate an element early.
    const scanLine = lineText.replace(/<%[\s\S]*?%>/g, '');
    for (const match of scanLine.matchAll(/<img\b([^>]*)>/gi)) {
      if (!/\balt\s*=/.test(match[1])) add(file, '1.1.1', 'Image is missing an alt attribute.', line);
    }
    for (const match of scanLine.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
      const attrs = match[2];
      if (/\btype\s*=\s*["']hidden["']/i.test(attrs)) continue;
      if (!hasAccessibleLabelHook(attrs) && !isWrappedByLabel(scanLine, match.index ?? 0, match[0].length)) add(file, '1.3.1', `${match[1]} has no label, id, or ARIA label hook.`, line);
    }
    for (const match of scanLine.matchAll(/<button\b([^>]*)>/gi)) {
      const attrs = match[1];
      if (!/\btype\s*=|\baria-label\s*=|\btitle\s*=/i.test(attrs)) add(file, '4.1.2', 'Button has no explicit type or accessible name hook.', line);
    }
    for (const match of scanLine.matchAll(/<(div|span)\b([^>]*)\b(onclick|role\s*=\s*["']button)/gi)) {
      if (!/\btabindex\s*=|\brole\s*=\s*["']button/i.test(match[2])) add(file, '2.1.1', 'Interactive non-native element is missing keyboard semantics.', line);
    }
  });
}
const cssFiles = [];
function walkCss(directory) { if (!fs.existsSync(directory)) return; for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const file=path.join(directory,entry.name); if(entry.isDirectory()) walkCss(file); else if(file.endsWith('.css')) cssFiles.push(file); } }
walkCss(path.join(root, 'frontend/public'));
const css = cssFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const checks = {
  focusVisible: /:focus-visible/.test(css),
  reducedMotion: /prefers-reduced-motion/.test(css),
  forcedColors: /forced-colors/.test(css),
  minTouchTarget: /min-(?:width|height)\s*:\s*(?:44|48)px/.test(css),
};
const summary = {
  generatedAt: new Date().toISOString(),
  templateCount: files.length,
  findingCount: findings.length,
  findingsByRule: Object.fromEntries([...new Set(findings.map((finding) => finding.rule))].map((rule) => [rule, findings.filter((finding) => finding.rule === rule).length])),
  cssChecks: checks,
  status: findings.length === 0 && checks.focusVisible && checks.reducedMotion ? 'pass' : 'needs_repair',
};
fs.mkdirSync(path.join(root, 'data/audits'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/audits/accessibility-audit.json'), JSON.stringify({ summary, findings }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (findings.length) console.log(JSON.stringify(findings.slice(0, 80), null, 2));

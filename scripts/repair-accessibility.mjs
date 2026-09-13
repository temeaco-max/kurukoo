/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ejs|html)$/.test(entry.name)) files.push(file);
  }
}
walk(path.join(root, 'views'));
walk(path.join(root, 'frontend/public'));
let changed = 0;
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let text = original;
  text = text.replace(/<button\b(?![^>]*\btype\s*=)([^>]*)>/gi, '<button type="button"$1>');
  text = text.replace(/<(input|textarea|select)\b(?![^>]*(?:\baria-label\s*=|\baria-labelledby\s*=|\bid\s*=))([^>]*)>/gi, (full, tag, attrs) => {
    if (/\btype\s*=\s*["']hidden["']/i.test(attrs)) return full;
    const placeholder = attrs.match(/\bplaceholder\s*=\s*["']([^"']+)["']/i)?.[1];
    const name = attrs.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    const label = placeholder || name || (type ? `${type} input` : `${tag} input`);
    return `<${tag}${attrs} aria-label="${label.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`;
  });
  text = text.replace(/<img\b(?![^>]*\balt\s*=)([^>]*)>/gi, (full, attrs) => {
    const source = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const filename = source.split('/').pop()?.split('?')[0]?.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') || 'Kurukoo image';
    return `<img alt="${filename.replace(/"/g, '&quot;')}"${attrs}>`;
  });
  if (text !== original) {
    fs.writeFileSync(file, text);
    changed += 1;
  }
}
const cssPath = path.join(root, 'frontend/public/css/site.css');
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('@media (forced-colors: active)')) {
  css += `\n\n/* WCAG high-contrast support shared by public, PWA, Chat, and admin surfaces. */\n@media (forced-colors: active) {\n  *, *::before, *::after { forced-color-adjust: auto; }\n  :where(a, button, input, select, textarea, summary, [role="button"]):focus { outline: 2px solid CanvasText; outline-offset: 3px; }\n  :where(button, [role="button"]) { border: 1px solid ButtonText; }\n  :where(a) { color: LinkText; }\n}\n`;
  fs.writeFileSync(cssPath, css);
  changed += 1;
}
console.log(JSON.stringify({ changedFiles: changed, message: 'Shared accessibility repairs applied.' }, null, 2));

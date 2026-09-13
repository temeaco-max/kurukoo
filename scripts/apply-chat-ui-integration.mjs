/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';

const path = 'frontend/public/dashboard.html';
const source = fs.readFileSync(path, 'utf8');
let out = source;

// The platform now has one canonical stylesheet: /css/site.css.
// Remove legacy chat-ui stylesheet injections from the PWA shell.
out = out.replace(/\s*<link rel="stylesheet" href="\/css\/chat-ui\.css[^"]*">/g, '');

if (!out.includes('/js/chat-ui-enhancements.js')) {
  out = out.replace(
    /(<\/head>)/,
    '    <script src="/js/chat-ui-enhancements.js?v=1.1.0" defer></script>\n$1'
  );
}

// Remove only presentation-only inline declarations that conflict with the shared design system.
out = out.replace(/\sstyle="display:\s*none\s*!important;"/g, '');

if (out === source) process.exit(0);
fs.writeFileSync(path, out);

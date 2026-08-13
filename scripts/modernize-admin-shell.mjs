import fs from 'node:fs';
import path from 'node:path';

const directory = path.join(process.cwd(), 'public', 'admin');
for (const name of fs.readdirSync(directory).filter(file => file.endsWith('.html'))) {
  const file = path.join(directory, name); let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>\s*/gi, '');
  html = html.replace(/\sstyle=("[^"]*"|'[^']*')/gi, '');
  html = html.replace(/\s*<script\s+src=["']\/admin\/admin-brand\.js["'][^>]*><\/script>/gi, '');
  if (!html.includes('/css/admin-control-room.css')) html = html.replace(/<\/head>/i, '    <link rel="stylesheet" href="/css/admin-control-room.css?v=1">\n</head>');
  if (!html.includes('/js/admin-shell.js')) html = html.replace(/<\/body>/i, '    <script src="/js/admin-shell.js?v=1"></script>\n</body>');
  fs.writeFileSync(file, html);
}
console.log('Applied shared Control Room shell assets and removed page-local CSS from admin HTML.');

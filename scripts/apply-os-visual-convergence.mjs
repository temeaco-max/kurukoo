import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stylesheet = '    <link rel="stylesheet" href="/css/kurukoo-os-architecture.css?v=1">';
const files = [
  'views/app.ejs',
  'views/workspace.ejs',
  'public/chat/index.html',
  'public/discover/index.html',
  'public/admin/index.html',
  'public/settings.html',
  'public/dashboard.html',
];

let changed = [];
for (const relative of files) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes('/css/kurukoo-os-architecture.css')) continue;

  const candidates = [
    /(<link[^>]+href=["'][^"']*kurukoo-workspace\.css[^"']*["'][^>]*>\s*)/i,
    /(<link[^>]+href=["'][^"']*kurukoo-chat\.css[^"']*["'][^>]*>\s*)/i,
    /(<link[^>]+href=["'][^"']*site\.css[^"']*["'][^>]*>\s*)/i,
    /(<\/head>)/i,
  ];
  let patched = false;
  for (const pattern of candidates) {
    if (pattern.test(source)) {
      source = source.replace(pattern, (_match, group) => `${group}${stylesheet}\n`);
      patched = true;
      break;
    }
  }
  if (patched) {
    fs.writeFileSync(file, source);
    changed.push(relative);
  }
}

console.log(JSON.stringify({ changed, count: changed.length }, null, 2));

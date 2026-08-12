import fs from 'fs';
import path from 'path';

const distIndex = path.join(process.cwd(), 'dist', 'index.js');

if (fs.existsSync(distIndex) && !import.meta.url.includes('/dist/')) {
  // @ts-ignore
  await import('./dist/index.js');
} else {
  // @ts-ignore
  await import('./src/index.js');
}

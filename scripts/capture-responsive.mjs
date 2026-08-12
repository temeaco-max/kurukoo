import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const target = process.argv[3] || '/';
const output = process.argv[4] || '/tmp/kurukoo-responsive';
const widths = [360, 390, 414, 768, 900, 1024, 1280, 1440];
const safeTarget = target.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
if (!existsSync(output)) mkdirSync(output, { recursive: true });
for (const width of widths) {
  const screenshot = path.join(output, `${safeTarget}-${width}.png`);
  rmSync(screenshot, { force: true });
  execFileSync('/usr/bin/chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${width},1200`, `--screenshot=${screenshot}`, `${baseUrl}${target}`,
  ], { stdio: 'pipe' });
  console.log(`${width}\t${screenshot}`);
}

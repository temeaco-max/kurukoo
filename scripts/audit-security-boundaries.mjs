import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const authSource = read('src/middleware/auth.ts');
const indexSource = read('src/index.ts');
const economicSource = read('src/routes/economicRequestRouter.ts');
const chatSource = read('public/js/kurukoo-primary-chat.js');
const hubSource = read('public/dashboard.html');

for (const rule of [
  { value: 'req.query.token', reason: 'JWTs must not be accepted from URLs' },
  { value: 'req.query.admin_token', reason: 'Admin tokens must not be accepted from URLs' },
  { value: '+2348030000000', reason: 'Demo/default phone identities must not ship in production paths' },
  { value: "localStorage.setItem('kurukoo_auth", reason: 'Browser auth must remain in HttpOnly cookies' },
]) {
  for (const relative of ['src/middleware/auth.ts', 'src/index.ts', 'src/routes/chatRouter.ts', 'public/js/kurukoo-primary-chat.js']) {
    const file = path.join(root, relative);
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(rule.value)) {
      failures.push(`${relative}: ${rule.reason} (${rule.value})`);
    }
  }
}

expect(!indexSource.includes('legacyApp') && !indexSource.includes('registerLegacyRoutes'),
  'src/index.ts must remain a composition root without a legacy route boundary');
expect(economicSource.includes("router.post('/orchestration/run', authenticateAdmin"),
  'orchestration maintenance route must apply explicit authenticateAdmin middleware');
expect(economicSource.includes("router.post('/memory/lifecycle', authenticateAdmin"),
  'memory lifecycle route must apply explicit authenticateAdmin middleware');
for (const route of [
  "router.post('/storefront/start', authenticateUser",
  "router.post('/storefront/:id/advance', authenticateUser",
  "router.get('/ai-quota', authenticateUser",
  "router.post('/', authenticateUser",
  "router.get('/:id', authenticateUser",
  "router.post('/:id/transition', authenticateUser",
  "router.post('/:id/escrow', authenticateUser",
  "router.post('/:id/complete', authenticateUser",
  "router.get('/memory/inspector', authenticateUser",
]) {
  expect(economicSource.includes(route), `Economic Request user-owned route lacks explicit auth: ${route}`);
}

for (const unsafeRenderer of [
  '.innerHTML = ',
  'onclick="',
]) {
  expect(!chatSource.includes(unsafeRenderer), `Unsafe dynamic renderer remains in chat client: ${unsafeRenderer}`);
  expect(!hubSource.includes(unsafeRenderer), `Unsafe dynamic renderer remains in Request Hub: ${unsafeRenderer}`);
}

expect(chatSource.includes('.textContent = '), 'Chat client must use textContent for dynamic content');
expect(hubSource.includes('.textContent = '), 'Request Hub must use textContent for dynamic content');
expect(hubSource.includes('.replaceChildren('), 'Request Hub must use replaceChildren for list rendering');

if (failures.length) {
  console.error('Security boundary audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Security boundary static invariants passed. The package command also runs HTTP authorization behavior tests.');

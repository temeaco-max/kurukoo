import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_SURFACES, MOBILE_PRIMARY_NAVIGATION } from '../src/services/clientSurfaceRegistry.js';

const root = process.cwd();
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const failures: string[] = [];

const requireFile = (relativePath: string, reason: string) => {
  if (!exists(relativePath)) failures.push(`${reason}: missing ${relativePath}`);
};

requireFile('public/css/kurukoo-client-foundation.css', 'Web/PWA visual authority');
requireFile('mobile/kurukoo-mobile/lib/visual-contract.ts', 'Native visual authority');
requireFile('mobile/kurukoo-mobile/app/(tabs)/_layout.tsx', 'Native primary navigation');
requireFile('public/js/kurukoo-app-shell.js', 'Web mobile app shell');
requireFile('docs/architecture/CLIENT_APPLICATION_CONVERGENCE.md', 'Client architecture contract');
requireFile('docs/architecture/CLIENT_FEATURE_COVERAGE.md', 'Feature coverage contract');

const publicRoutes = read('src/routes/publicRoutes.ts');
for (const route of ['/chat', '/requests', '/tasks', '/connect', '/discover', '/points', '/top-up', '/subscription', '/call']) {
  if (!publicRoutes.includes(`router.get('${route}'`)) failures.push(`Web route registry missing ${route}`);
}

for (const file of ['index.tsx', 'discover.tsx', 'requests.tsx', 'tasks.tsx', 'connect.tsx']) {
  requireFile(`mobile/kurukoo-mobile/app/(tabs)/${file}`, `Native surface`);
}

const mobileTabs = read('mobile/kurukoo-mobile/app/(tabs)/_layout.tsx');
const tabExpectations: Record<string, string> = {
  agent: 'name="index" options={{ title: "Agent" }}',
  discover: 'name="discover" options={{ title: "Discover" }}',
  requests: 'name="requests" options={{ title: "Requests" }}',
  tasks: 'name="tasks" options={{ title: "Tasks" }}',
  connect: 'name="connect" options={{ title: "Connect" }}',
};
for (const domain of MOBILE_PRIMARY_NAVIGATION) {
  const expected = tabExpectations[domain];
  if (!expected || !mobileTabs.includes(expected)) failures.push(`Native primary navigation missing ${domain}`);
}

const registryFamilies = new Set(CLIENT_SURFACES.map(surface => surface.family));
for (const family of ['web', 'pwa', 'native', 'admin']) {
  if (!registryFamilies.has(family as never)) failures.push(`Client surface registry has no ${family} family`);
}

const adminRouter = read('src/routes/adminRoutes.ts');
if (!adminRouter.includes('/admin')) failures.push('Admin route authority not found in src/routes/adminRoutes.ts');

const mobilePackage = read('mobile/kurukoo-mobile/package.json');
if (!mobilePackage.includes('expo-router')) failures.push('Native client is not an Expo Router application');
if (!mobilePackage.includes('expo-camera')) failures.push('Native client is missing camera capability required for linking/QR');
if (!mobilePackage.includes('expo-notifications')) failures.push('Native client is missing push/notification capability');

const surfaceIds = new Set(CLIENT_SURFACES.map(surface => surface.id));
for (const required of ['web-marketing', 'web-chat', 'web-discover', 'web-requests', 'web-tasks', 'web-connect', 'web-agents', 'web-capabilities', 'web-opportunities', 'web-wallet', 'web-artifacts', 'web-prayer', 'web-call', 'pwa-shell', 'native-ios', 'native-android', 'admin-control-room']) {
  if (!surfaceIds.has(required)) failures.push(`Client surface registry missing ${required}`);
}

if (failures.length) {
  console.error('Kurukoo client-surface coverage failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Kurukoo client-surface coverage passed: ${CLIENT_SURFACES.length} declared surfaces; Web/PWA/native/Admin authorities present; five-domain mobile navigation present.`);

import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_SURFACES, MOBILE_PRIMARY_NAVIGATION } from '../src/services/clientSurfaceRegistry.js';
import { CLIENT_FEATURE_ENTRYPOINTS } from '../src/services/clientFeatureEntryPoints.js';

const root = process.cwd();
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures: string[] = [];
const requireFile = (relativePath: string, reason: string) => { if (!exists(relativePath)) failures.push(`${reason}: missing ${relativePath}`); };

requireFile('public/css/kurukoo-client-foundation.css', 'Web/PWA visual authority');
requireFile('mobile/kurukoo-mobile/lib/visual-contract.ts', 'Native visual authority');
requireFile('mobile/kurukoo-mobile/app/(tabs)/_layout.tsx', 'Native primary navigation');
requireFile('public/js/kurukoo-app-shell.js', 'Web mobile navigation module');
requireFile('views/app.ejs', 'Canonical authenticated Web App shell');
requireFile('src/routes/appSurfaceRoutes.ts', 'Canonical authenticated Web App router');
requireFile('src/routes/contentRoutes.ts', 'Canonical public content/resource router');
requireFile('views/resources/index.ejs', 'Resources hub frontend');
requireFile('views/resources/article.ejs', 'Resource article frontend');
requireFile('public/js/kurukoo-resources.js', 'Resources frontend behavior module');
requireFile('src/routes/topicRoutes.ts', 'Topics route authority');
requireFile('views/topics/index.ejs', 'Topics list frontend');
requireFile('views/topics/detail.ejs', 'Topic detail frontend');
requireFile('public/js/kurukoo-topics.js', 'Topics frontend behavior module');
requireFile('public/admin/index.html', 'Admin control room shell');
requireFile('public/js/kurukoo-admin.js', 'Admin control room behavior');
requireFile('docs/architecture/CLIENT_APPLICATION_CONVERGENCE.md', 'Client architecture contract');
requireFile('docs/architecture/CLIENT_FEATURE_COVERAGE.md', 'Feature coverage contract');

if (CLIENT_FEATURE_ENTRYPOINTS.length < 30) failures.push(`Historical feature inventory is incomplete: expected at least 30 entrypoints, found ${CLIENT_FEATURE_ENTRYPOINTS.length}`);
const featureIds = new Set(CLIENT_FEATURE_ENTRYPOINTS.map((feature) => feature.id));
for (const required of ['food','groceries','errands','logistics','parcels','fuel','mobility','home-services','repairs','solar','automotive','health','money-circle','emergency','security','neighborhood-safety','gigs','classifieds','advertising','contributors','sports','circles','price-alerts','government','exam-results','airtime-data','universal-remote','events','hawkers','prayer']) if (!featureIds.has(required)) failures.push(`Historical capability entrypoint missing ${required}`);

const publicRoutes = read('src/routes/publicRoutes.ts');
const topicRoutes = read('src/routes/topicRoutes.ts');
const contentRoutes = read('src/routes/contentRoutes.ts');
const publicRouteExpectations = ['/chat', '/requests', '/tasks', '/connect', '/discover', '/points', '/top-up', '/subscription', '/call', '/how-it-works', '/explore', '/network', '/channels', '/help', '/partners', '/advertise', '/about', '/contact', '/pricing', '/blog', '/careers', '/api-docs'];
for (const route of publicRouteExpectations) if (!publicRoutes.includes(`router.get('${route}'`)) failures.push(`Public/compatibility Web route missing ${route}`);
if (!contentRoutes.includes("router.get('/resources'")) failures.push('Resources public route missing');
if (!contentRoutes.includes("router.get('/resources/:slug'")) failures.push('Resource detail route missing');
if (!contentRoutes.includes("router.get('/api/resources'")) failures.push('Resources API list route missing');
if (!contentRoutes.includes("router.get('/api/resources/:slug'")) failures.push('Resources API detail route missing');
if (!topicRoutes.includes("router.get('/topics'")) failures.push('Topics public/API route missing');
if (!topicRoutes.includes("router.get('/topics/:slug'")) failures.push('Topic detail route missing');

const appRouter = read('src/routes/appSurfaceRoutes.ts');
if (!appRouter.includes("router.get('/app', optionalAuthenticateUser")) failures.push('Canonical Web App root route missing');
if (!appRouter.includes('for (const section of surfaceMap.keys())')) failures.push('Canonical Web App dynamic section routing is missing');
for (const route of CLIENT_SURFACES.filter(s => s.family === 'web' && s.route.startsWith('/app/')).map(s => s.route.replace('/app/', ''))) if (!appRouter.includes(`['${route}'`)) failures.push(`Canonical Web App surface ${route} missing from surface map`);

const app = read('views/app.ejs');
if (!app.includes('href="/app/topics"')) failures.push('Authenticated Web App navigation is missing Topics');
if (!app.includes("section === 'topics'")) failures.push('Authenticated Web App has no Topics representation');
if (!app.includes('href="/topics"')) failures.push('Authenticated Web App Topics surface does not connect to canonical Topics frontend');
for (const route of ['/app/reminders', '/app/saved', '/app/cart']) if (!appRouter.includes(`['${route.replace('/app/', '')}'`)) failures.push(`Authenticated Web App surface map missing ${route}`);

const admin = read('public/admin/index.html');
for (const section of ['providers', 'compliance', 'settings']) if (!admin.includes(`/admin/?section=${section}`)) failures.push(`Admin navigation missing ${section} section`);
const adminJs = read('public/js/kurukoo-admin.js');
for (const section of ['providers', 'compliance', 'settings']) if (!adminJs.includes(`section === '${section}'`)) failures.push(`Admin implementation missing ${section} panel`);

for (const file of ['index.tsx', 'discover.tsx', 'requests.tsx', 'tasks.tsx', 'connect.tsx']) requireFile(`mobile/kurukoo-mobile/app/(tabs)/${file}`, 'Native surface');

const mobileTabs = read('mobile/kurukoo-mobile/app/(tabs)/_layout.tsx');
const tabExpectations: Record<string, string> = { agent: 'name="index" options={{ title: "Agent" }}', discover: 'name="discover" options={{ title: "Discover" }}', requests: 'name="requests" options={{ title: "Requests" }}', tasks: 'name="tasks" options={{ title: "Tasks" }}', connect: 'name="connect" options={{ title: "Connect" }}' };
for (const domain of MOBILE_PRIMARY_NAVIGATION) { const expected = tabExpectations[domain]; if (!expected || !mobileTabs.includes(expected)) failures.push(`Native primary navigation missing ${domain}`); }

const registryFamilies = new Set(CLIENT_SURFACES.map(surface => surface.family));
for (const family of ['web', 'pwa', 'native', 'admin']) if (!registryFamilies.has(family as never)) failures.push(`Client surface registry has no ${family} family`);

const index = read('src/index.ts');
if (!index.includes("import appSurfaceRoutes from './routes/appSurfaceRoutes.js'")) failures.push('Canonical Web App router is not imported by src/index.ts');
if (!index.includes("app.use('/',appSurfaceRoutes)")) failures.push('Canonical Web App router is not mounted by src/index.ts');
if (!index.includes("contentRoutes")) failures.push('Content/resource router is not mounted by src/index.ts');

const mobilePackage = read('mobile/kurukoo-mobile/package.json');
if (!mobilePackage.includes('expo-router')) failures.push('Native client is not an Expo Router application');
if (!mobilePackage.includes('expo-camera')) failures.push('Native client is missing camera capability required for linking/QR');
if (!mobilePackage.includes('expo-notifications')) failures.push('Native client is missing push/notification capability');

const surfaceIds = new Set(CLIENT_SURFACES.map(surface => surface.id));
for (const required of ['web-marketing', 'web-how-it-works', 'web-explore', 'web-discover-public', 'web-topics-public', 'web-network', 'web-channels', 'web-resources', 'web-help', 'web-partners', 'web-advertise', 'web-chat', 'web-topics', 'web-requests', 'web-reminders', 'web-saved', 'web-cart', 'web-tasks', 'web-connect', 'web-agents', 'web-capabilities', 'web-opportunities', 'web-wallet', 'web-points', 'web-top-up', 'web-subscriptions', 'web-checkout', 'web-confirmations', 'web-memory', 'web-notifications', 'web-artifacts', 'web-prayer', 'web-call', 'web-safety', 'pwa-shell', 'native-ios', 'native-android', 'admin-control-room', 'admin-providers', 'admin-compliance', 'admin-settings']) if (!surfaceIds.has(required)) failures.push(`Client surface registry missing ${required}`);

if (failures.length) { console.error('Kurukoo client-surface coverage failed:'); failures.forEach(failure => console.error(`- ${failure}`)); process.exit(1); }
console.log(`Kurukoo client-surface coverage passed: ${CLIENT_SURFACES.length} declared client surfaces and ${CLIENT_FEATURE_ENTRYPOINTS.length} historical capability entrypoints; public teaching, Resources, authenticated Web App, Topics/community, Admin operator sections, PWA/native authorities and five-domain mobile navigation present.`);
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_SURFACES, MOBILE_PRIMARY_NAVIGATION } from '../src/services/clientSurfaceRegistry.js';
import { CLIENT_FEATURE_ENTRYPOINTS } from '../src/services/clientFeatureEntryPoints.js';

const root = process.cwd();
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures: string[] = [];
const requireFile = (relativePath: string, reason: string) => { if (!exists(relativePath)) failures.push(`${reason}: missing ${relativePath}`); };

for (const file of [
  'public/css/kurukoo-client-foundation.css',
  'public/css/kurukoo-screen-set-convergence.css',
  'public/css/kurukoo-visual-completion.css',
  'public/css/kurukoo-platform-state-visual.css',
  'public/css/kurukoo-chat-visual-completion.css',
  'public/css/kurukoo-workspace-visual-completion.css',
  'public/css/kurukoo-visual-system.css',
  'public/css/kurukoo-os-final.css',
  'public/css/kurukoo-os-workspace-final.css',
  'public/css/kurukoo-os-visual-advancement.css',
  'public/css/kurukoo-webapp-pixel-refinement.css',
  'public/css/kurukoo-webapp-screen-refinement.css',
  'public/css/kurukoo-webapp-agent-refinement.css',
] as const) requireFile(file, 'Web visual authority');
requireFile('mobile/kurukoo-mobile/lib/visual-contract.ts', 'Native visual authority');
requireFile('mobile/kurukoo-mobile/components/kurukoo-ui.tsx', 'Native shared visual primitives');
requireFile('mobile/kurukoo-mobile/components/work-surface-detail.tsx', 'Native work surface visual convergence');
requireFile('mobile/kurukoo-mobile/app/(tabs)/_layout.tsx', 'Native primary navigation');
requireFile('public/js/kurukoo-app-shell.js', 'Web mobile navigation/runtime module');
requireFile('public/js/kurukoo-pwa.js', 'PWA lifecycle/runtime owner');
requireFile('public/offline.html', 'Offline platform-state surface');
requireFile('views/app.ejs', 'Canonical authenticated Web App shell');
requireFile('src/routes/appSurfaceRoutes.ts', 'Canonical authenticated Web App router');
requireFile('src/routes/contentRoutes.ts', 'Canonical public content/resource router');
requireFile('public/api-docs.html', 'API docs visual surface');
requireFile('views/resources/index.ejs', 'Resources hub frontend');
requireFile('views/resources/article.ejs', 'Resource article frontend');
requireFile('public/js/kurukoo-resources.js', 'Resources frontend behavior module');
requireFile('src/routes/topicRoutes.ts', 'Topics route authority');
requireFile('views/topics/index.ejs', 'Topics list frontend');
requireFile('views/topics/detail.ejs', 'Topic detail frontend');
requireFile('public/admin/index.html', 'Admin control room shell');
requireFile('public/admin/ai-agents.html', 'Admin AI agents screen');
requireFile('public/js/kurukoo-admin.js', 'Admin control room behavior');
requireFile('public/css/admin-console.css', 'Admin agent visual authority');
requireFile('docs/architecture/CLIENT_APPLICATION_CONVERGENCE.md', 'Client architecture contract');
requireFile('docs/architecture/CLIENT_FEATURE_COVERAGE.md', 'Feature coverage contract');

if (CLIENT_FEATURE_ENTRYPOINTS.length < 30) failures.push(`Historical feature inventory is incomplete: expected at least 30 entrypoints, found ${CLIENT_FEATURE_ENTRYPOINTS.length}`);
const featureIds = new Set(CLIENT_FEATURE_ENTRYPOINTS.map((feature) => feature.id));
for (const required of ['food','groceries','errands','logistics','parcels','fuel','mobility','home-services','repairs','solar','automotive','health','money-circle','emergency','security','neighborhood-safety','gigs','classifieds','advertising','contributors','sports','circles','price-alerts','government','exam-results','airtime-data','universal-remote','events','hawkers','prayer']) if (!featureIds.has(required)) failures.push(`Historical capability entrypoint missing ${required}`);

const publicRoutes = read('src/routes/publicRoutes.ts');
const topicRoutes = read('src/routes/topicRoutes.ts');
const contentRoutes = read('src/routes/contentRoutes.ts');
const publicRouteExpectations = ['/chat', '/discover', '/how-it-works', '/explore', '/network', '/channels', '/help', '/partners', '/advertise', '/about', '/contact', '/pricing', '/blog', '/careers', '/api-docs'];
const publicWorkspaceDuplicates = ['/requests', '/tasks', '/connect', '/points', '/top-up', '/subscription', '/call', '/confirmation', '/daily-picks'];
const retiredSingularAliases = ['/subscription', '/confirmation', '/daily-picks'];
for (const route of publicRouteExpectations) if (!publicRoutes.includes(`router.get('${route}'`)) failures.push(`Public Web route missing ${route}`);
for (const route of publicWorkspaceDuplicates) if (publicRoutes.includes(`router.get('${route}'`)) failures.push(`Public router retains duplicate workspace route ${route}`);
if (!contentRoutes.includes("router.get('/resources'")) failures.push('Resources public route missing');
if (!contentRoutes.includes("router.get('/resources/:slug'")) failures.push('Resource detail route missing');
if (!contentRoutes.includes("router.get('/api/resources'")) failures.push('Resources API list route missing');
if (!contentRoutes.includes("router.get('/api/resources/:slug'")) failures.push('Resources API detail route missing');
if (!topicRoutes.includes("router.get('/topics'")) failures.push('Topics public/API route missing');
if (!topicRoutes.includes("router.get('/topics/:slug'")) failures.push('Topic detail route missing');

const appRouter = read('src/routes/appSurfaceRoutes.ts');
if (!appRouter.includes("'/desk': 'desk'")) failures.push('Canonical Web App desk route is missing');
if (!appRouter.includes('cleanCanonicalSections')) failures.push('Canonical Web App direct section routing is missing');
for (const route of CLIENT_SURFACES.filter(s => s.family === 'web' && /^\/(desk|requests|tasks|connect|agents|capabilities|opportunities|wallet|points|top-up|subscriptions|checkout|confirmations|memory|artifacts|prayer|call|notifications|safety|settings)$/.test(s.route)).map(s => s.route.slice(1))) if (!appRouter.includes(`'/${route}'`)) failures.push(`Canonical Web App surface ${route} missing from direct route map`);
for (const route of retiredSingularAliases) if (appRouter.includes(`'${route}'`)) failures.push(`Canonical Web App must not expose retired alias ${route}`);

const app = read('views/app.ejs');
const deskSystem = read('public/js/kurukoo-desk-system.js');
const deskData = read('public/js/kurukoo-desk-data.js');
if (!deskSystem.includes("makeDeskModule('agent-objectives'")) failures.push('Desk lacks a dedicated canonical Agent objectives module');
for (const marker of ['/api/agent/goals', '/continuation', '/trace?limit=3', 'waiting_on_dependency', 'goalActivityLabel', 'goalPresenceLabel', 'safeBlockedByLabel', 'goalStatusPriority']) if (!deskData.includes(marker)) failures.push(`Desk Agent objective projection is missing ${marker}`);
for (const marker of ['slice(0, 4)', 'for (const { goal } of goalDetails)', 'Waiting on a prerequisite objective']) if (!deskData.includes(marker)) failures.push(`Desk Agent objective projection is missing bounded safe hydration ${marker}`);
if (deskData.includes('raw tool arguments') || deskData.includes('provider secrets') || deskData.includes('blockers.join')) failures.push('Desk Agent objective projection must not expose internal execution details or raw dependency identifiers');
for (const marker of ['Waiting for earlier work', 'Your input is needed', 'dataset.state = state']) if (!deskData.includes(marker)) failures.push(`Desk visual Objective language or state hook is missing ${marker}`);
const visualAdvancement = read('public/css/kurukoo-os-visual-advancement.css');
for (const marker of ['Final OS visual system', 'status-pill', 'waiting_on_dependency', 'needs_user', 'k-app-list-loading::before', 'prefers-reduced-motion']) if (!visualAdvancement.includes(marker)) failures.push(`Shared authenticated visual state authority is missing ${marker}`);
const requestClient = read('public/js/kurukoo-requests-convergence.js');
for (const forbidden of ['Request ID', '/confirmation?request=', 'Continue my agent objective ${linkedGoal.id}', 'Show me my agent objective ${linkedGoal.id']) if (requestClient.includes(forbidden)) failures.push(`Requests surface exposes a retired route or internal identifier pattern: ${forbidden}`);
for (const marker of ['/confirmations?request=', 'Objective ·', 'Continue the objective for this request.']) if (!requestClient.includes(marker)) failures.push(`Requests surface is missing safe Objective continuation marker ${marker}`);
const notificationClient = read('public/js/kurukoo-notifications-convergence.js');
if (notificationClient.includes('Context ${item.context_id}')) failures.push('Notifications surface exposes raw context identifiers');
for (const marker of ['actionLabelFor', 'Review and decide', 'Continue in Chat']) if (!notificationClient.includes(marker)) failures.push(`Notifications surface lacks user-safe action wording ${marker}`);
const taskClient = read('public/js/kurukoo-tasks-convergence.js');
for (const forbidden of ['Task #${escape(task.id)}', 'Task ${task?.id || \'\'}', 'task ${task?.id || \'\'}']) if (taskClient.includes(forbidden)) failures.push(`Tasks surface exposes an internal task identifier: ${forbidden}`);
for (const marker of ['Part of an objective', 'Part of a request', 'Waiting for earlier work']) if (!taskClient.includes(marker)) failures.push(`Tasks surface lacks user-safe Objective/task continuity marker ${marker}`);
const primaryChat = read('public/js/kurukoo-primary-chat.js');
for (const marker of ['waiting_on_dependency', 'Waiting for earlier work', 'dataset.objectiveState', 'A confirmed step was recorded.']) if (!primaryChat.includes(marker)) failures.push(`Chat Objective presentation is missing ${marker}`);
for (const marker of ["input?.setAttribute('aria-invalid', 'true')", 'Kurukoo is unavailable', 'Your message is still in the composer', "toast.setAttribute('role', needsResponse ? 'alert' : 'status')"]) if (!primaryChat.includes(marker)) failures.push(`Chat unavailability feedback is missing ${marker}`);
if (!app.includes('k-app-section-<%= section %>')) failures.push('Authenticated Web App lacks explicit section identity hook');
if (!app.includes('href="/topics"')) failures.push('Authenticated Web App navigation is missing Topics');
if (!app.includes("section === 'topics'")) failures.push('Authenticated Web App has no Topics representation');
if (!app.includes('href="/topics"')) failures.push('Authenticated Web App Topics surface does not connect to canonical Topics frontend');
for (const route of ['reminders', 'saved', 'cart']) if (!appRouter.includes(`'/${route}'`)) failures.push(`Authenticated Web App direct route map missing ${route}`);

const head = read('views/_partials/head.ejs');
if (!head.includes('/css/kurukoo-screen-set-convergence.css')) failures.push('Shared screen-set convergence stylesheet is not loaded');
if (!head.includes('/css/kurukoo-visual-completion.css')) failures.push('Final visual completion stylesheet is not loaded');
if (!head.includes('/css/kurukoo-visual-system.css')) failures.push('Shared visual system stylesheet is not loaded');
if (!head.includes('k-route-${routeSlug}')) failures.push('Route-level screen-set hook is missing');
if (!head.includes('k-screen-set-${screenSet}')) failures.push('Screen-set classification hook is missing');

const appShell = read('public/js/kurukoo-app-shell.js');
if (!appShell.includes('kurukoo-webapp-pixel-refinement')) failures.push('Web App runtime does not mount pixel refinement authority');
if (!appShell.includes('kurukoo-webapp-screen-refinement')) failures.push('Web App runtime does not mount sequential screen refinement authority');
if (!appShell.includes('kurukoo-webapp-agent-refinement')) failures.push('Web App runtime does not mount first-screen Agent refinement authority');
if (!appShell.includes("path==='/chat'")) failures.push('Web App Agent page-specific refinement is not scoped to the Agent route');
if (appShell.includes('/app/agent')) failures.push('Web App runtime retains a legacy Agent alias');
if (!appShell.includes('kurukoo-os-final')) failures.push('Web App runtime does not mount OS final authority');

const chat = read('public/chat/index.html');
if (!chat.includes('/js/kurukoo-pwa.js')) failures.push('Chat/PWA runtime owner missing');
if (!chat.includes('/css/kurukoo-chat.css')) failures.push('Chat base visual authority missing');
const workspace = read('views/workspace.ejs');
if (!workspace.includes('/css/kurukoo-workspace.css')) failures.push('Workspace base visual authority missing');

for (const [file, markers] of [
  ['views/how-it-works.ejs', ['k-screen-header', 'how-it-works-grid']],
  ['views/network.ejs', ['k-context-band', 'network-grid']],
  ['views/resources/index.ejs', ['k-screen-card', 'latest-guides-section']],
  ['views/contact.ejs', ['k-screen-set', 'contact-grid']],
  ['views/legal.ejs', ['k-legal-layout', 'k-legal-content']],
  ['views/provider-profile.ejs', ['k-screen-set', 'k-context-band', 'k-evidence-grid']],
] as const) {
  const source = read(file); for (const marker of markers) if (!source.includes(marker)) failures.push(`${file} is missing visual screen-set marker ${marker}`);
}
const completionCss = read('public/css/kurukoo-visual-completion.css');
for (const marker of ['k-route-contact', 'k-route-pricing', 'k-route-explore', 'k-screen-set-content']) if (!completionCss.includes(marker)) failures.push(`Final visual completion layer is missing ${marker}`);
const platformCss = read('public/css/kurukoo-platform-state-visual.css');
for (const marker of ['k-platform-status', 'offline-page', 'chat-runtime-banner']) if (!platformCss.includes(marker)) failures.push(`Platform lifecycle visual authority is missing ${marker}`);
const chatCompletionCss = read('public/css/kurukoo-chat-visual-completion.css');
for (const marker of ['chat-content', 'composer', 'chat-inspector', 'data-objective-state', 'agent-goal-event']) if (!chatCompletionCss.includes(marker)) failures.push(`Chat visual completion authority is missing ${marker}`);
const workspaceCompletionCss = read('public/css/kurukoo-workspace-visual-completion.css');
for (const marker of ['chat-template-shell', 'workspace-hero-card', 'workspace-panel']) if (!workspaceCompletionCss.includes(marker)) failures.push(`Workspace visual completion authority is missing ${marker}`);
const pixelCss = read('public/css/kurukoo-webapp-pixel-refinement.css');
for (const marker of ['k-app-shell', 'k-app-sidebar', 'k-app-title-row', 'k-app-card', 'k-mobile-tabbar', 'workspace-page']) if (!pixelCss.includes(marker)) failures.push(`Pixel refinement authority is missing ${marker}`);
const screenCss = read('public/css/kurukoo-webapp-screen-refinement.css');
for (const marker of ['k-app-section-discover', 'k-app-section-requests', 'k-app-section-tasks', 'k-app-section-connect', 'k-app-section-checkout', 'k-app-section-memory', 'k-app-section-agents']) if (!screenCss.includes(marker)) failures.push(`Sequential Web App screen refinement is missing ${marker}`);
const agentCss = read('public/css/kurukoo-webapp-agent-refinement.css');
for (const marker of ['.k-app-grid.two .k-app-card:first-child', '.k-app-grid.two .k-app-card:nth-child(2)']) if (!agentCss.includes(marker)) failures.push(`First-screen Agent refinement is missing ${marker}`);

const nativeUi = read('mobile/kurukoo-mobile/components/kurukoo-ui.tsx');
for (const marker of ['PlatformStateBanner', 'EvidenceRow', 'ContinuityBand', 'StatusPill']) if (!nativeUi.includes(`function ${marker}`)) failures.push(`Native shared visual primitive missing ${marker}`);
const workSurface = read('mobile/kurukoo-mobile/components/work-surface-detail.tsx');
for (const marker of ['PlatformStateBanner', 'EvidenceRow']) if (!workSurface.includes(marker)) failures.push(`Native work surface is not consuming ${marker}`);

const admin = read('public/admin/index.html');
if (!admin.includes('id="admin-section-panel"')) failures.push('Admin dynamic section panel is missing');
const adminJs = read('public/js/kurukoo-admin.js');
for (const section of ['providers', 'compliance', 'settings']) if (!adminJs.includes(`section === '${section}'`)) failures.push(`Admin implementation missing ${section} panel`);
const agentAdminCss = read('public/css/admin-console.css');
for (const marker of ['runtime-readiness-card', 'agent-actions', 'test-agent-card']) if (!agentAdminCss.includes(marker)) failures.push(`Agent operational visual layer is missing ${marker}`);

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
console.log(`Kurukoo client-surface coverage passed: ${CLIENT_SURFACES.length} declared client surfaces and ${CLIENT_FEATURE_ENTRYPOINTS.length} historical capability entrypoints; shared calm lifecycle states, user-safe Objective continuity, identifier redaction, Chat/Workspace authorities, PWA/native authorities and five-domain mobile navigation are present.`);
/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
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
  'frontend/public/css/kurukoo-client-foundation.css',
  'frontend/public/css/kurukoo-screen-set-convergence.css',
  'frontend/public/css/kurukoo-visual-completion.css',
  'frontend/public/css/kurukoo-platform-state-visual.css',
  'frontend/public/css/kurukoo-chat-visual-completion.css',
  'frontend/public/css/kurukoo-workspace-visual-completion.css',
  'frontend/public/css/kurukoo-visual-system.css',
  'frontend/public/css/kurukoo-os-final.css',
  'frontend/public/css/kurukoo-os-workspace-final.css',
  'frontend/public/css/kurukoo-os-visual-advancement.css',
  'frontend/public/css/kurukoo-webapp-pixel-refinement.css',
  'frontend/public/css/kurukoo-webapp-screen-refinement.css',
  'frontend/public/css/kurukoo-webapp-agent-refinement.css',
] as const) requireFile(file, 'Web visual authority');
requireFile('mobile/kurukoo-mobile/lib/visual-contract.ts', 'Native visual authority');
requireFile('mobile/kurukoo-mobile/components/kurukoo-ui.tsx', 'Native shared visual primitives');
requireFile('mobile/kurukoo-mobile/components/work-surface-detail.tsx', 'Native work surface visual convergence');
requireFile('mobile/kurukoo-mobile/app/(tabs)/_layout.tsx', 'Native primary navigation');
requireFile('frontend/public/js/kurukoo-app-shell.js', 'Web mobile navigation/runtime module');
requireFile('frontend/public/js/kurukoo-pwa.js', 'PWA lifecycle/runtime owner');
requireFile('frontend/public/offline.html', 'Offline platform-state surface');
requireFile('views/app.ejs', 'Canonical authenticated Web App shell');
requireFile('src/routes/appSurfaceRoutes.ts', 'Canonical authenticated Web App router');
requireFile('src/routes/contentRoutes.ts', 'Canonical public content/resource router');
requireFile('frontend/public/api-docs.html', 'API docs visual surface');
requireFile('views/resources/index.ejs', 'Resources hub frontend');
requireFile('views/resources/article.ejs', 'Resource article frontend');
requireFile('frontend/public/js/kurukoo-resources.js', 'Resources frontend behavior module');
requireFile('src/routes/topicRoutes.ts', 'Topics route authority');
requireFile('views/topics/index.ejs', 'Topics list frontend');
requireFile('views/topics/detail.ejs', 'Topic detail frontend');
requireFile('admin/index.html', 'Admin control room shell');
requireFile('admin/ai-agents.html', 'Admin AI agents screen');
requireFile('frontend/public/js/kurukoo-admin.js', 'Admin control room behavior');
requireFile('frontend/public/css/admin-console.css', 'Admin agent visual authority');
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
const deskSystem = read('frontend/public/js/kurukoo-desk-system.js');
const deskData = read('frontend/public/js/kurukoo-desk-data.js');
if (!deskSystem.includes("makeDeskModule('agent-objectives'")) failures.push('Desk lacks a dedicated canonical Agent objectives module');
for (const marker of ['/api/agent/goals', '/continuation', '/trace?limit=3', 'waiting_on_dependency', 'goalActivityLabel', 'goalPresenceLabel', 'safeBlockedByLabel', 'goalStatusPriority', "paused: 'Paused by you'", 'exactChatHref', 'economic_request.open', 'task.open', 'reminder.open']) if (!deskData.includes(marker)) failures.push(`Desk Agent objective projection is missing ${marker}`);
for (const marker of ['slice(0, 4)', 'for (const { goal } of goalDetails)', 'Waiting on a prerequisite objective']) if (!deskData.includes(marker)) failures.push(`Desk Agent objective projection is missing bounded safe hydration ${marker}`);
if (deskData.includes('raw tool arguments') || deskData.includes('provider secrets') || deskData.includes('blockers.join')) failures.push('Desk Agent objective projection must not expose internal execution details or raw dependency identifiers');
for (const marker of ['Waiting for earlier work', 'Your decision is needed', 'dataset.state = state', 'Your review is needed', 'economic_request.open', 'agent.goal.review']) if (!deskData.includes(marker)) failures.push(`Desk visual Objective language or exact-notification continuation hook is missing ${marker}`);
for (const forbidden of ['${id.slice(0, 8)}', 'Task ${String(task.id || \'\').slice(0, 8)}', 'Continue my ${skill} request ${id}', 'Continue my request ${r.id}', 'Show reminder ${rem.id']) if (deskData.includes(forbidden)) failures.push(`Desk must not expose a raw identifier or generic object continuation: ${forbidden}`);
const canonicalProtocol = read('src/services/universalCapabilityProtocol.ts');
if (!canonicalProtocol.includes('contact:communication.compose')) failures.push('Canonical context protocol does not allow the explicit contact compose action.');
if (!canonicalProtocol.includes('memory_context:memory.context.open')) failures.push('Canonical context protocol does not allow the explicit Memory fact review action.');
const legacyIntentRouter = read('src/services/legacyIntentRouter.ts');
for (const marker of ['row?.card_data ?? row?.cardData', 'getPersonProfile(phone, recipientPhone, \'message\')']) if (!legacyIntentRouter.includes(marker)) failures.push(`Prepared communication recovery is missing canonical persistence or exact-contact handling: ${marker}`);
const visualAdvancement = read('frontend/public/css/kurukoo-os-visual-advancement.css');
for (const marker of ['Final OS visual system', 'status-pill', 'waiting_on_dependency', 'needs_user', 'k-app-list-loading::before', 'prefers-reduced-motion']) if (!visualAdvancement.includes(marker)) failures.push(`Shared authenticated visual state authority is missing ${marker}`);
// Requests/Activity surface now uses the unified app shell surface loader (k-app-surface)
// Section-specific request convergence files have been removed in favor of one visual system
for (const marker of ['requestEyebrow', 'economic_request:${requestId}', "requestId ? 'Continue in Chat' : 'Open Chat'", 'conversationId']) if (!workspaceClient.includes(marker)) failures.push(`Native Requests loader lacks exact canonical context or safe request presentation: ${marker}`);
for (const forbidden of ['`request:${requestId}`', "Continue this request."]) if (workspaceClient.includes(forbidden)) failures.push(`Native Requests loader retains a mismatched or generic request continuation: ${forbidden}`);
for (const marker of ["canonicalAction: 'task.open'", "canonicalAction: 'reminder.open'", 'Continue in Chat', 'source_conversation_id', 'Task waiting for attention', 'Reminder time reached']) if (!workspaceClient.includes(marker)) failures.push(`Native Tasks or Reminders workspace lacks exact safe continuation: ${marker}`);
for (const forbidden of ['`Task ${task.id || \'\'}`', 'Continue task context', 'Open source context', 'Source: ${humanize(sourceType)}']) if (workspaceClient.includes(forbidden)) failures.push(`Native Tasks workspace retains an internal identifier or generic continuation: ${forbidden}`);
const appConvergence = read('frontend/public/js/kurukoo-app-convergence.js');
for (const marker of ['requestStatusText', 'requestTitleText', 'exactRequestChatHref', 'economic_request.open', 'No requests are in progress. Start in Chat when you need something done.', 'Boolean(id)']) if (!appConvergence.includes(marker)) failures.push(`App-shell Requests fallback lacks canonical continuation or human status language: ${marker}`);
for (const forbidden of ['${r.status||\'unknown\'}${r.id?` · ${r.id}`:\'\'}', 'Continue my ${r.skill||r.category||\'request\'}', '`Task ${t.id}`']) if (appConvergence.includes(forbidden)) failures.push(`App-shell Requests or Tasks fallback retains a raw identifier or generic continuation: ${forbidden}`);
for (const marker of ['taskStatusText', 'taskTitleText', 'exactTaskChatHref', 'reminderStatusText', 'exactReminderChatHref', "canonicalAction','task.open'", "canonicalAction','reminder.open'", 'Reminder time reached']) if (!appConvergence.includes(marker)) failures.push(`App-shell Tasks or Reminders fallback lacks truthful state or exact canonical continuation: ${marker}`);
  for (const marker of ['validMemoryFactId', 'exactMemoryFactChatHref', "canonicalAction','memory.context.open'", 'Remove from active memory', 'Only active details you can review and remove are shown here.']) if (!appConvergence.includes(marker)) failures.push(`App-shell Memory fallback lacks owner-safe fact review or exact continuation: ${marker}`);
  for (const marker of ['Card payments', 'Ready for payment', 'Not connected', 'Verified payment step prepared']) if (!appConvergence.includes(marker)) failures.push(`App-shell Wallet/Checkout fallback lacks truthful payment readiness wording: ${marker}`);
  if (appConvergence.includes("textContent:'Stripe'")) failures.push('App-shell Wallet must not expose payment-provider implementation labels.');
for (const marker of ['async function settings()', 'Your account, privacy and connections.', '/api/memory/profile', '/api/profile/update', 'Save details', 'Manage saved context', 'Review updates', 'Review connections', '/api/profile/export', 'Download my data', '/api/profile/delete', 'Delete my account data', 'Connections are only active after you explicitly approve them.', 'settings,agents:agentGoals']) if (!appConvergence.includes(marker)) failures.push(`App-shell Settings surface lacks a canonical owner-backed control or truthful integration boundary: ${marker}`);
if (/const map=\{[^}]*settings/.test(appConvergence) === false) failures.push('App-shell Settings surface is not wired into the authenticated renderer map.');
// Notifications surface now uses unified app shell
for (const forbidden of ["return `/requests/${escapePath(id)}`", "return `/tasks/${escapePath(id)}`", "return `/topics/${escapePath(id)}`", 'Delivery accepted by provider']) if (notificationClient.includes(forbidden)) failures.push(`Notifications surface retains a generic fallback or implementation-facing delivery label: ${forbidden}`);
// Tasks surface now uses unified app shell
// Contacts surface now uses unified app shell
// Memory surface now uses unified app shell
const economicRequestRoutes = read('src/routes/economicRequestRouter.ts');
if (!economicRequestRoutes.includes('sourceConversationId')) failures.push('Memory facts route does not project the owner-verified source conversation needed for exact continuation.');
const primaryChat = read('frontend/public/js/kurukoo-primary-chat.js');
for (const marker of ['contactCompose', 'kurukoo_contact_message_draft', "canonicalAction: 'communication.compose'", 'Message draft ready']) if (!primaryChat.includes(marker)) failures.push(`Chat lacks the private contact compose continuation contract: ${marker}`);
for (const marker of ['waiting_on_dependency', 'Waiting for earlier work', 'dataset.objectiveState', 'A confirmed step was recorded.', 'resumeCanonicalContextOnLoad', "void sendMessage(input.value)", "card.type === 'reminder_action' ? 'Reminder review'", "card.type === 'task_action' ? 'Task review'", 'Reminder time reached', 'memory.context.open', "item.title || item.field || 'Saved item'", "saved: 'Saved'"]) if (!primaryChat.includes(marker)) failures.push(`Chat Objective presentation or exact workspace continuation is missing ${marker}`);
for (const forbidden of ['Provenance: ${String(fact.provenance', 'Provenance: ${String(item.provenance']) if (primaryChat.includes(forbidden)) failures.push(`Chat Memory presentation exposes raw provenance: ${forbidden}`);
for (const marker of ["input?.setAttribute('aria-invalid', 'true')", 'Kurukoo is unavailable', 'Your message is still in the composer', "toast.setAttribute('role', needsResponse ? 'alert' : 'status')"]) if (!primaryChat.includes(marker)) failures.push(`Chat unavailability feedback is missing ${marker}`);
for (const marker of ["chat-toast chat-toast--approval", "toast.setAttribute('role', 'alert')", "toast.setAttribute('aria-live', 'assertive')"]) if (!primaryChat.includes(marker)) failures.push(`Chat device-approval announcement is missing ${marker}`);
for (const marker of ["card.type === 'emergency' || card.type === 'emergency_dispatch'", 'Emergency help', 'Ready for you to call', "holder.setAttribute('aria-live', 'assertive')", 'approximate location available']) if (!primaryChat.includes(marker)) failures.push(`Chat emergency card is missing ${marker}`);
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

const appShell = read('frontend/public/js/kurukoo-app-shell.js');
if (!appShell.includes('kurukoo-webapp-pixel-refinement')) failures.push('Web App runtime does not mount pixel refinement authority');
if (!appShell.includes('kurukoo-webapp-screen-refinement')) failures.push('Web App runtime does not mount sequential screen refinement authority');
if (!appShell.includes('kurukoo-webapp-agent-refinement')) failures.push('Web App runtime does not mount first-screen Agent refinement authority');
if (!appShell.includes("path==='/chat'")) failures.push('Web App Agent page-specific refinement is not scoped to the Agent route');
if (appShell.includes('/app/agent')) failures.push('Web App runtime retains a legacy Agent alias');
if (!appShell.includes('kurukoo-os-final')) failures.push('Web App runtime does not mount OS final authority');

const chat = read('frontend/public/chat/index.html');
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
const completionCss = read('frontend/public/css/kurukoo-visual-completion.css');
for (const marker of ['k-route-contact', 'k-route-pricing', 'k-route-explore', 'k-screen-set-content']) if (!completionCss.includes(marker)) failures.push(`Final visual completion layer is missing ${marker}`);
const platformCss = read('frontend/public/css/kurukoo-platform-state-visual.css');
for (const marker of ['k-platform-status', 'offline-page', 'chat-runtime-banner']) if (!platformCss.includes(marker)) failures.push(`Platform lifecycle visual authority is missing ${marker}`);
const chatCompletionCss = read('frontend/public/css/kurukoo-chat-visual-completion.css');
for (const marker of ['chat-content', 'composer', 'chat-inspector', 'data-objective-state', 'agent-goal-event']) if (!chatCompletionCss.includes(marker)) failures.push(`Chat visual completion authority is missing ${marker}`);
const workspaceCompletionCss = read('frontend/public/css/kurukoo-workspace-visual-completion.css');
for (const marker of ['chat-template-shell', 'workspace-hero-card', 'workspace-panel']) if (!workspaceCompletionCss.includes(marker)) failures.push(`Workspace visual completion authority is missing ${marker}`);
const pixelCss = read('frontend/public/css/kurukoo-webapp-pixel-refinement.css');
for (const marker of ['k-app-shell', 'k-app-sidebar', 'k-app-title-row', 'k-app-card', 'k-mobile-tabbar', 'workspace-page']) if (!pixelCss.includes(marker)) failures.push(`Pixel refinement authority is missing ${marker}`);
const screenCss = read('frontend/public/css/kurukoo-webapp-screen-refinement.css');
for (const marker of ['k-app-section-discover', 'k-app-section-requests', 'k-app-section-tasks', 'k-app-section-connect', 'k-app-section-checkout', 'k-app-section-memory', 'k-app-section-agents']) if (!screenCss.includes(marker)) failures.push(`Sequential Web App screen refinement is missing ${marker}`);
const agentCss = read('frontend/public/css/kurukoo-webapp-agent-refinement.css');
for (const marker of ['.k-app-grid.two .k-app-card:first-child', '.k-app-grid.two .k-app-card:nth-child(2)']) if (!agentCss.includes(marker)) failures.push(`First-screen Agent refinement is missing ${marker}`);

const nativeUi = read('mobile/kurukoo-mobile/components/kurukoo-ui.tsx');
for (const marker of ['PlatformStateBanner', 'EvidenceRow', 'ContinuityBand', 'StatusPill']) if (!nativeUi.includes(`function ${marker}`)) failures.push(`Native shared visual primitive missing ${marker}`);
const workSurface = read('mobile/kurukoo-mobile/components/work-surface-detail.tsx');
for (const marker of ['PlatformStateBanner', 'EvidenceRow']) if (!workSurface.includes(marker)) failures.push(`Native work surface is not consuming ${marker}`);

const admin = read('admin/index.html');
if (!admin.includes('id="admin-section-panel"')) failures.push('Admin dynamic section panel is missing');
const adminJs = read('frontend/public/js/kurukoo-admin.js');
for (const section of ['providers', 'compliance', 'settings']) if (!adminJs.includes(`section === '${section}'`)) failures.push(`Admin implementation missing ${section} panel`);
const agentAdminCss = read('frontend/public/css/admin-console.css');
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
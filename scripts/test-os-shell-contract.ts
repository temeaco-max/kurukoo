import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAT_SIDEBAR_FOUNDATION } from '../src/services/chatSidebarFoundation.js';
import { KURUKOO_OS_COMPONENTS } from '../src/services/kurukooOsComponentRegistry.js';

const shellRuntime = readFileSync(resolve(process.cwd(), 'public/js/kurukoo-desk-system.js'), 'utf8');
const appShellRuntime = readFileSync(resolve(process.cwd(), 'public/js/kurukoo-app-shell.js'), 'utf8');
const componentCss = readFileSync(resolve(process.cwd(), 'public/css/kurukoo-os-components.css'), 'utf8');
const finalCss = readFileSync(resolve(process.cwd(), 'public/css/kurukoo-os-final.css'), 'utf8');
const pixelCss = readFileSync(resolve(process.cwd(), 'public/css/kurukoo-webapp-pixel-refinement.css'), 'utf8');
const providerCss = readFileSync(resolve(process.cwd(), 'public/css/provider-communication.css'), 'utf8');
const presenceRuntime = readFileSync(resolve(process.cwd(), 'public/js/kurukoo-agent-presence.js'), 'utf8');
const icons = readFileSync(resolve(process.cwd(), 'public/icons/kurukoo-icons.svg'), 'utf8');
const appRoutes = readFileSync(resolve(process.cwd(), 'src/routes/appSurfaceRoutes.ts'), 'utf8');
const surfaceRegistry = readFileSync(resolve(process.cwd(), 'src/services/clientSurfaceRegistry.ts'), 'utf8');

for (const required of [
  'Search Kurukoo','Notifications','Account','/points','/cart','/chat','/requests','/tasks','/discover','/connect','/topics','/saved','/reminders','/memory','/safety','/settings'
]) assert.ok(shellRuntime.includes(required), `Desk shell missing ${required}`);
assert.ok(shellRuntime.includes("'k-desk-search-trigger'"));
assert.ok(shellRuntime.includes("'k-desk-header-cart'"));
assert.ok(shellRuntime.includes('renderOsWorkspace'));
assert.ok(shellRuntime.includes('renderContext'));
assert.doesNotMatch(shellRuntime, /\/app\//, 'Desk shell must use direct canonical routes without legacy app aliases');
assert.ok(componentCss.includes('.kos-conversation-card'));
assert.ok(componentCss.includes('.kos-activity-card'));
assert.ok(componentCss.includes('.kos-object-list'));
assert.ok(componentCss.includes('.kos-opportunity-card'));
assert.ok(componentCss.includes('.kos-context-drawer'));
assert.ok(componentCss.includes('data-ko-state="approval-required"'));
assert.ok(componentCss.includes('data-agent-presence="listening"'));
assert.ok(finalCss.includes('.k-app-page .k-app-nav'));
assert.ok(finalCss.includes('.ko-communication-actions'));
assert.ok(finalCss.includes('[data-state="approval-required"]'));
assert.ok(finalCss.includes('.ko-empty,.empty-state'));
assert.ok(finalCss.includes('--kc-accent:var(--ko-primary)'));
assert.ok(pixelCss.includes('--kwa-ink:var(--ko-ink)'));
assert.ok(pixelCss.includes('--kwa-accent:var(--ko-primary)'));
assert.ok(pixelCss.includes('.k-app-ask{min-height:44px'));
assert.ok(pixelCss.includes('background:var(--ko-primary)'));
assert.ok(providerCss.includes('var(--ko-primary'));
assert.ok(providerCss.includes('min-height:44px'));
assert.ok(providerCss.includes('button[disabled]'));
assert.ok(presenceRuntime.includes("'listening'"));

for (const [label, href] of [['Desk','/desk'],['Agent','/chat'],['Requests','/requests'],['Tasks','/tasks'],['Discover','/discover']]) {
  assert.ok(appShellRuntime.includes(`{label:'${label}',href:'${href}'`), `mobile/app navigation must use canonical ${label} route ${href}`);
}
assert.ok(appShellRuntime.includes('const createSecondaryNav=()=>{}'));
assert.ok(appShellRuntime.includes("if(path==='/chat')"), 'Agent route refinement must use the canonical Chat route');
assert.doesNotMatch(appShellRuntime, /\/app\//, 'App shell must not retain legacy route aliases');
assert.ok(appShellRuntime.includes("if(path==='/call')"));
assert.ok(appShellRuntime.includes("path==='/top-up'||path==='/points'"));

assert.match(surfaceRegistry, /label: 'Agent'.*route: '\/chat'/s, 'surface registry Agent must be /chat');
assert.match(surfaceRegistry, /label: 'Agents'.*route: '\/agents'/s, 'Agents directory must remain distinct from Agent');
assert.match(appRoutes, /'\/desk': 'desk'/, 'app routes must declare Desk directly');
assert.doesNotMatch(appRoutes, /'\/app/, 'app routes must not retain legacy aliases');
assert.match(appRoutes, /for \(const resource of \['requests','tasks','reminders','opportunities','agents','connections','memory','artifacts'\]/, 'canonical object/detail route families remain declared');

assert.match(icons, /symbol id="search"/);
assert.match(icons, /symbol id="user"/);
assert.ok(CHAT_SIDEBAR_FOUNDATION.some((item) => item.id === 'cart' && item.targetPlacement === 'header'));
assert.ok(CHAT_SIDEBAR_FOUNDATION.some((item) => item.id === 'notifications' && item.targetPlacement === 'header'));
assert.ok(KURUKOO_OS_COMPONENTS.some((item) => item.id === 'conversation-continuation-card'));
assert.ok(KURUKOO_OS_COMPONENTS.some((item) => item.id === 'pulse-timeline'));
assert.ok(KURUKOO_OS_COMPONENTS.some((item) => item.id === 'context-inspector'));

console.log('OS shell contract passed: canonical authenticated route ownership, shared state/presence vocabulary, mobile IA, non-duplicated workspace navigation and canonical visual token bridges are present.');

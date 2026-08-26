import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const failures: string[] = [];
const require = (value: boolean, message: string) => { if (!value) failures.push(message); };

const publicNav = read('views/_partials/nav.ejs');
const publicRoutes = read('src/routes/publicRoutes.ts');
for (const route of ['/explore','/channels','/about','/help','/chat']) require(publicNav.includes(`href="${route}"`), `Public header missing ${route}`);
for (const route of ['/explore','/channels','/about','/help','/chat']) require(publicRoutes.includes(`router.get('${route}'`), `Public route owner missing ${route}`);

const app = read('views/app.ejs');
const appRoutes = read('src/routes/appSurfaceRoutes.ts');
const directSections: Record<string, string> = { agent: 'chat', discover: 'discover', requests: 'requests', tasks: 'tasks', connect: 'connect', reminders: 'reminders', saved: 'saved', cart: 'cart', agents: 'agents', capabilities: 'capabilities', opportunities: 'opportunities', topics: 'topics', wallet: 'wallet', points: 'points', 'top-up': 'top-up', subscriptions: 'subscriptions', checkout: 'checkout', confirmations: 'confirmations', memory: 'memory', artifacts: 'artifacts', prayer: 'prayer', call: 'call', notifications: 'notifications', safety: 'safety' };
for (const [section, route] of Object.entries(directSections)) require(appRoutes.includes(`'/${route}'`), `Authenticated canonical route missing /${route} for ${section}`);
for (const route of ['desk','discover','requests','tasks','connect']) require(app.includes(`href="/${route}"`), `Authenticated desktop primary navigation does not expose /${route}`);
require(app.includes('href="/chat"'), 'Authenticated Web App missing Chat recovery');
require(!app.includes('/app/'), 'Authenticated Web App must not retain legacy app aliases');
require(!app.includes('/daily-picks'), 'Authenticated Web App must not retain a Daily Picks alias');
require(app.includes('class="k-app-sidebar"'), 'Authenticated desktop sidebar missing');
require(app.includes('class="k-mobile-tabbar"'), 'Authenticated responsive navigation contract missing');

const appShell = read('public/js/kurukoo-app-shell.js');
require(!appShell.includes('/app/'), 'Authenticated runtime must use direct canonical routes without legacy normalizers');
require(appShell.includes("path==='/chat'"), 'Agent refinement must target the direct canonical Chat route');

const adminIndex = read('public/admin/index.html');
const adminAuth = read('public/admin/admin-auth.js');
require(!adminIndex.includes('<nav class="k-nav"'), 'Control Room must not own a second Admin navigation');
require(adminIndex.includes('/admin/admin-auth.js'), 'Control Room must load the canonical Admin navigation owner');
for (const [href, label] of [
  ['/admin/','Control Room'], ['/admin/?section=conversations','Conversations'], ['/admin/?section=providers','Providers'], ['/admin/?section=economic','Economic'], ['/admin/?section=moderation','Moderation'], ['/admin/?section=compliance','Compliance'], ['/admin/?section=notifications','Notifications'], ['/admin/?section=connectors','Integrations'], ['/admin/ai-agents.html','Agents'], ['/admin/users.html','Users'], ['/admin/pricing.html','Pricing'], ['/admin/referrals.html','Referrals'], ['/admin/commissions.html','Commissions'], ['/admin/partnerships.html','Partnerships'], ['/admin/scam.html','Scam & trust'], ['/admin/social.html','Social'], ['/admin/artists.html','Creators'], ['/admin/celebrity.html','Celebrity'], ['/admin/analytics.html','Analytics'], ['/admin/revenue.html','Revenue'], ['/admin/marketing.html','Marketing'], ['/admin/ads.html','Advertising'], ['/admin/content.html','Content'], ['/admin/curation.html','Curation'], ['/admin/?section=settings','Settings'], ['/admin/?section=seo','SEO'], ['/admin/future.html','Roadmap']
] as const) require(adminAuth.includes(`['${href}', '${label}']`), `Admin navigation missing ${label}`);
require(adminAuth.includes('href="/" target="_blank"'), 'Admin navigation missing public-site bridge');
require(adminAuth.includes('href="/chat"'), 'Admin navigation missing canonical Agent bridge');
require(!adminAuth.includes('/app/agent'), 'Admin navigation must not retain a legacy Agent alias');
require(adminAuth.includes('/admin/login.html'), 'Admin navigation missing auth recovery');

if (failures.length) {
  console.error('Desktop screen-flow contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Desktop screen-flow contract passed: public frontend, authenticated Web App and Admin have canonical owners, recovery paths, cross-plane bridges and no duplicate Control Room navigation.');

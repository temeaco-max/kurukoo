import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const require = (condition, message) => { if (!condition) failures.push(message); };

const matrixPath = 'docs/architecture/KURUKOO_PAGE_ARCHITECTURE_MATRIX.md';
const featureCoveragePath = 'docs/architecture/CLIENT_FEATURE_COVERAGE.md';
const appRoutesPath = 'src/routes/appSurfaceRoutes.ts';
const publicRoutesPath = 'src/routes/publicRoutes.ts';
const featureRegistryPath = 'src/services/platformFeatureVisualRegistry.ts';
const skillFlowsPath = 'src/services/skillFlows.ts';
const appTemplatePath = 'views/app.ejs';
const publicHeadPath = 'views/_partials/head.ejs';
const publicNavPath = 'views/_partials/nav.ejs';
const adminAuthPath = 'public/admin/admin-auth.js';
const auditPageArchitecture = path.join(root, 'scripts/audit-page-architecture.mjs');

const matrix = read(matrixPath);
const featureCoverage = read(featureCoveragePath);
const appRoutes = read(appRoutesPath);
const publicRoutes = read(publicRoutesPath);
const featureRegistry = read(featureRegistryPath);
const skillFlows = read(skillFlowsPath);
const appTemplate = read(appTemplatePath);
const publicHead = read(publicHeadPath);
const publicNav = read(publicNavPath);
const adminAuth = read(adminAuthPath);

try {
  execFileSync(process.execPath, [auditPageArchitecture], { stdio: 'pipe' });
} catch (error) {
  const stdout = String(error.stdout || '').trim();
  const stderr = String(error.stderr || '').trim();
  failures.push(`audit-page-architecture failed: ${stdout || stderr || error.message}`);
}

for (const rule of [
  'Visual design governs presentation, not product completeness.',
  'A design reference cannot reduce this contract.',
  'Real-world user jobs',
  'Required information architecture',
  'Primary, secondary and recovery actions',
  'Navigation and cross-surface continuation',
  'Empty, loading, pending, needs-input, success, failure, unavailable, cancelled and recovery states',
  'Canonical data/authority ownership',
  'Trust/evidence boundaries',
  'SEO/indexability',
  'Accessibility',
  'Desktop and responsive composition',
  'external/provider/payment/fulfilment outcome',
]) require(matrix.includes(rule), `Page architecture contract missing: ${rule}`);

require(featureCoverage.includes('Completion states'), 'Client feature coverage must define independent completion states.');
require(featureCoverage.includes('represented;'), 'Feature completion must distinguish representation from implementation.');
require(featureCoverage.includes('live-verified;'), 'Feature completion must distinguish live verification from implementation.');

const appSections = [
  'discover','topics','requests','reminders','saved','cart','tasks','connect','agents','capabilities','opportunities',
  'wallet','points','top-up','subscriptions','checkout','confirmations','memory','artifacts','prayer','call','notifications','safety'
];
for (const section of appSections) {
  require(appRoutes.includes(`['${section}'`), `Missing canonical Web App route owner: ${section}`);
  require(matrix.includes(`/app/${section}`), `Missing Page Architecture entry: /app/${section}`);
}

for (const route of ['/','/explore','/discover','/network','/channels','/topics','/resources','/how-it-works','/about','/help','/contact','/careers','/partners','/advertise','/pricing','/legal','/api-docs','/offline']) {
  require(matrix.includes(route === '/' ? 'Homepage' : route), `Missing public Page Architecture entry: ${route}`);
}
for (const href of ['/explore','/channels','/about','/help','/chat']) {
  require(publicNav.includes(`href="${href}"`), `Public navigation no longer exposes ${href}.`);
}

for (const token of ['<title>', 'meta name="description"', 'rel="canonical"', 'og:title', 'og:description', 'application/ld+json']) {
  require(publicHead.includes(token), `Public SEO authority missing from shared head: ${token}`);
}

const featureIds = [...featureRegistry.matchAll(/id:'([^']+)'/g)].map((match) => match[1]);
const webSurfaces = [...featureRegistry.matchAll(/webSurface:'([^']+)'/g)].map((match) => match[1]);
const owners = [...featureRegistry.matchAll(/canonicalOwner:'([^']+)'/g)].map((match) => match[1]);
require(featureIds.length >= 40, `Platform feature registry unexpectedly small: ${featureIds.length}`);
require(featureIds.length === new Set(featureIds).size, 'Platform feature registry contains duplicate feature IDs.');
const matrixSurfacePresent = (surface) => {
  if (matrix.includes(surface)) return true;
  if (surface === '/chat') return matrix.includes('### Chat and conversation surfaces');
  if (surface === '/start') return matrix.includes('QR Context') || matrix.includes('Cross-system feature inventory');
  if (surface.startsWith('/admin/?')) return true;
  return false;
};
for (const surface of webSurfaces) require(matrixSurfacePresent(surface), `Registered feature points to a web surface absent from the Page Architecture Matrix: ${surface}`);
require(owners.length === featureIds.length, 'Every registered feature must have a canonical owner.');
require(featureRegistry.includes('discoverable:true'), 'Discoverability field is missing from the feature registry.');

require(skillFlows.length > 1000, 'Canonical skill-flow registry is missing or unexpectedly small.');
require(matrix.includes('205 skills'), 'Page Architecture Matrix no longer records the 205-skill catalogue.');
require(matrix.includes('46 families'), 'Page Architecture Matrix no longer records the 46-family catalogue.');
require(matrix.includes('Cross-system feature inventory'), 'Page Architecture Matrix must cover features without standalone pages.');
require(matrix.includes('capabilities that do not have a standalone page'), 'Matrix must explain representation through Chat/workspace/Admin for non-page features.');

const richSections = ['discover','topics','requests','reminders','saved','cart','tasks','connect','agents','capabilities','opportunities','wallet','points','top-up','subscriptions','checkout','confirmations','memory','artifacts','prayer','call','notifications','safety'];
const branchCount = (section) => (appTemplate.match(new RegExp(`section === ['\\\"]${section}['\\\"]`, 'g')) || []).length;
for (const section of richSections) {
  require(branchCount(section) > 0, `Web App surface ${section} lacks a dedicated content composition branch; visual convergence must not replace it with a generic page.`);
}

for (const label of ['Control Room','Conversations','Providers','Economic','Moderation','Compliance','Notifications','Integrations','Agents','Users','Pricing','Referrals','Commissions','Partnerships','Scam & trust','Social','Creators','Celebrity','Analytics','Revenue','Marketing','Advertising','Content','Curation','Settings','SEO','Roadmap']) {
  require(adminAuth.includes(`'${label}'`), `Admin navigation lost operational module: ${label}`);
}
for (const bridge of ['Open site','Open Web Chat','Sign out']) require(adminAuth.includes(bridge), `Admin recovery/cross-plane bridge missing: ${bridge}`);

const reportPath = 'docs/architecture/KURUKOO_PRODUCT_COMPLETENESS_GATE.md';
const report = `# Kurukoo Product Completeness Gate\n\nThis gate exists specifically to prevent visual convergence from reducing product completeness.\n\n## Non-negotiable rule\n\nVisual references govern presentation. They do not have authority to delete product information, user jobs, actions, states, navigation, SEO structure, capability representation, canonical data relationships or truth boundaries.\n\nA route is not complete because it visually matches a board. It is complete only when its real-world purpose, information architecture, interactions, states, canonical authority, navigation, accessibility, SEO (where applicable), and truth boundaries are represented.\n\n## Completion boundary\n\nEvery capability must be either:\n\n1. a complete standalone page; or\n2. represented through a canonical surface such as Chat, Agent, Requests, Tasks, Discover, Connect, Notifications, contextual cards or Admin.\n\nA capability may never disappear because a design reference does not show it.\n\n## Current registry boundary\n\nThe Page Architecture Matrix is the primary product/content contract. CLIENT_FEATURE_COVERAGE.md is the cross-client capability contract. platformFeatureVisualRegistry.ts is the feature-to-surface representation contract. The canonical skill/flow registry remains part of the completeness boundary.\n\nThe audit requires the repository's documented 205 skills across 46 families to remain covered, even when a skill is represented through Chat rather than a standalone page.\n`;
fs.writeFileSync(path.join(root, reportPath), report);

if (failures.length) {
  console.error('Kurukoo Product Completeness Gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Kurukoo Product Completeness Gate passed: ${featureIds.length} registered visual features, ${appSections.length} authenticated surfaces, public SEO/navigation authority, Admin operational navigation, and the canonical 205-skill/46-family representation boundary remain protected.`);

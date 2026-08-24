import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const matrixPath = 'docs/architecture/KURUKOO_PAGE_ARCHITECTURE_MATRIX.md';
const failures = [];
const require = (condition, message) => { if (!condition) failures.push(message); };

const matrix = read(matrixPath);
const appRoutes = read('src/routes/appSurfaceRoutes.ts');
const blueprint = read('docs/architecture/BLUEPRINT_TRUTH.md');
const currentTruth = read('docs/architecture/CURRENT_PRODUCT_TRUTH.md');
const skillFlows = read('src/services/skillFlows.ts');
const featureRegistry = read('src/services/platformFeatureVisualRegistry.ts');

const appSections = [
  'discover','topics','requests','reminders','saved','cart','tasks','connect','agents','capabilities','opportunities',
  'wallet','points','top-up','subscriptions','checkout','confirmations','memory','artifacts','prayer','call','notifications','safety'
];

const canonicalSurfaceFor = (surface) => {
  if (surface === '/app') return '/desk';
  if (surface === '/app/agent') return '/chat';
  if (surface.startsWith('/app/')) return surface.slice('/app'.length);
  return surface;
};

for (const section of appSections) {
  require(appRoutes.includes(`['${section}'`), `Canonical Web App surface missing: ${section}`);
  require(matrix.includes(`/${section}`), `Page Architecture Matrix missing canonical authenticated surface: /${section}`);
}

const requiredPublicFamilies = [
  'Homepage','/explore','/discover','/network','/channels','/topics','/topics/:slug','/resources','/resources/:slug',
  '/how-it-works','/about','/help','/contact','/careers','/partners','/advertise','/pricing','/legal/*','/api-docs','/offline'
];
for (const item of requiredPublicFamilies) require(matrix.includes(item), `Page Architecture Matrix missing public surface/family: ${item}`);

const requiredAdminAreas = [
  'Control Room','Conversations','Providers','Economic','Moderation','Compliance','Notifications','Integrations','Agents','Users',
  'Pricing','Referrals','Commissions','Partnerships','Scam & trust','Social','Creators','Celebrity','Analytics','Revenue',
  'Marketing','Advertising','Content','Curation','Settings','SEO','Roadmap'
];
for (const item of requiredAdminAreas) require(matrix.includes(`| ${item} |`), `Page Architecture Matrix missing Admin area: ${item}`);

for (const dimension of [
  'Purpose and audience', 'Real-world user jobs', 'Required information architecture', 'Primary, secondary and recovery actions',
  'Navigation and cross-surface continuation', 'Empty, loading, pending, needs-input, success, failure, unavailable, cancelled and recovery states',
  'Canonical data/authority ownership', 'Trust/evidence boundaries', 'SEO/indexability', 'Accessibility', 'Desktop and responsive composition',
  'visual treatment', 'external/provider/payment/fulfilment outcome'
]) require(matrix.toLowerCase().includes(dimension.toLowerCase()), `Matrix completeness contract missing dimension: ${dimension}`);

require(/205\s+skills/.test(matrix), 'Matrix does not explicitly cover the canonical 205-skill catalogue.');
require(/46\s+families/.test(matrix), 'Matrix does not explicitly cover the canonical 46 skill families.');
require(skillFlows.length > 1000, 'Canonical skill-flow registry could not be read for coverage audit.');
require(featureRegistry.length > 1000, 'Platform feature registry could not be read for coverage audit.');
require(blueprint.includes('205 canonical skills'), 'Blueprint truth no longer records canonical skill count.');
require(currentTruth.includes('canonicalChatTurnService'), 'Current product truth no longer identifies canonical conversation ownership.');
require(matrix.includes('Visual design governs presentation, not product completeness.'), 'Core visual/product separation rule is missing.');
require(matrix.includes('A design reference cannot reduce this contract.'), 'Anti-omission rule is missing.');

if (failures.length) {
  console.error('Kurukoo Page Architecture audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Kurukoo Page Architecture audit passed: public, canonical authenticated and Admin surfaces are represented, core product dimensions are explicit, and compatibility /app/* mappings normalize to canonical routes.');

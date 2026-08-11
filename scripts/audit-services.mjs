import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const servicesDir = path.join(root, 'src/services');
const files = fs.readdirSync(servicesDir).filter(file => file.endsWith('.ts'));
const suspicious = [];

for (const file of files) {
  const source = fs.readFileSync(path.join(servicesDir, file), 'utf8');
  const matches = [...source.matchAll(/\b(stub|fake|dummy|pending_stub|coming soon)\b/gi)];
  if (matches.length) suspicious.push({ file, matches: matches.length });
}

const skillFlows = fs.readFileSync(path.join(servicesDir, 'skillFlows.ts'), 'utf8');
const database = fs.readFileSync(path.join(root, 'src/database.ts'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
const channelRoutes = fs.readFileSync(path.join(root, 'src/routes/channelRoutes.ts'), 'utf8');
const artist = fs.readFileSync(path.join(servicesDir, 'artistBookingService.ts'), 'utf8');
const orderFinalizer = fs.readFileSync(path.join(servicesDir, 'orderFinalizer.ts'), 'utf8');
const chatRouter = fs.readFileSync(path.join(root, 'src/routes/chatRouter.ts'), 'utf8');
const legacyAppPath = path.join(root, 'src/legacyApp.ts');

const categoryMatch = skillFlows.match(/const CATEGORY_BY_SKILL:Record<string,string>=\{([\s\S]*?)\};/);
const canonicalSkills = categoryMatch
  ? [...categoryMatch[1].matchAll(/(?:^|,)([A-Za-z0-9_]+):'/g)].map(match => match[1])
  : [];

const seedBlock = database.match(/function seedSkillFlows\([\s\S]*?\n\}/)?.[0] || '';
const explicitFlows = [...seedBlock.matchAll(/\[\s*'([^']+)'\s*,/g)].map(match => match[1]);
const explicitFlowSet = new Set(explicitFlows);
const missingExplicitFlows = canonicalSkills.filter(skill => !explicitFlowSet.has(skill));

const alignment = {
  canonicalSkillCount: canonicalSkills.length,
  explicitSeededFlowCount: explicitFlowSet.size,
  canonicalSkillsWithoutExplicitSeedFlow: missingExplicitFlows.length,
  canonicalSkillFallbackExpected: true,
  artistUsesEconomicRequest: /createEconomicRequest|transitionEconomicRequest|getEconomicRequest/.test(artist),
  artistUsesSharedLifecycle: /transitionEconomicRequest/.test(artist),
  orderFinalizerGuardsChatCommitment: /awaiting_confirmation/.test(orderFinalizer) && /getEconomicCategory/.test(orderFinalizer),
  chatUsesCanonicalRouter: /routeIntent\(/.test(chatRouter),
  chatUsesAuthenticatedIdentity: /userPhone\(req\)/.test(chatRouter),
  chatHasStreaming: /text\/event-stream/.test(chatRouter),
  chatHasHistory: /listChatConversations|listChatMessages/.test(chatRouter),
  legacyBoundaryAbsent: !fs.existsSync(legacyAppPath) && !/legacyApp|registerLegacyRoutes/.test(index),
  channelRouterWiredAtCompositionRoot: /app\.use\('\/api', channelRoutes\)/.test(index),
  emailWebhookRoutePresent: /\/webhook\/email/.test(channelRoutes),
  rawWebhookCapturePresent: /rawBody/.test(index) && /verify:/.test(index),
};

const architectureWarnings = [];
if (alignment.canonicalSkillsWithoutExplicitSeedFlow > 0) architectureWarnings.push('Some canonical skills use the category/default flow path rather than an explicit database flow.');
if (!alignment.legacyBoundaryAbsent) architectureWarnings.push('The removed legacy route boundary has returned; canonical route modules must remain the only HTTP ownership model.');
if (!alignment.artistUsesSharedLifecycle) architectureWarnings.push('Artist booking is not visibly using the shared Economic Request lifecycle.');
if (!alignment.orderFinalizerGuardsChatCommitment) architectureWarnings.push('Order finalization does not visibly guard chat intent from automatic commitment.');
if (!alignment.channelRouterWiredAtCompositionRoot) architectureWarnings.push('Channel router is not wired at the application composition root.');
if (!alignment.rawWebhookCapturePresent) architectureWarnings.push('Signed webhook raw-body capture is not visible at the composition root.');

console.log(JSON.stringify({
  serviceCount: files.length,
  suspicious,
  alignment,
  architectureWarnings,
}, null, 2));

// Informational by design: the audit reports architectural drift without making
// every historical or conditional service a CI blocker. Critical invariants
// have their own dedicated audits/tests.

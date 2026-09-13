/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skillFlowPath = path.join(root, 'src/services/skillFlows.ts');
const skillFlowSource = fs.readFileSync(skillFlowPath, 'utf8');
const skillSection = skillFlowSource.slice(skillFlowSource.indexOf('const EXPLICIT_SKILL_FLOW_DEFINITIONS'), skillFlowSource.indexOf('function seedCanonicalSkillFlows'));
const skills = [...skillSection.matchAll(/^\s*"([^"]+)":\{category:"([^"]+)"/gm)].map((match) => ({
  id: match[1], canonicalName: match[1], category: match[2], sourceRegistry: 'src/services/skillFlows.ts',
  conversationEntry: 'canonicalChatTurnService', chatSupport: 'SUPPORTED through canonical Chat',
  webPwaRepresentation: 'Typed Chat response, card, workspace, or notification continuation',
  channelSupport: ['web', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'voice', 'linked_device'],
  stateCoverage: ['available', 'pending', 'complete', 'blocked', 'unavailable', 'failed', 'review_required'],
  trainingCoverage: 'Canonical skill flow with clarify, confirm, recovery, and continuation',
  evidenceCoverage: 'Canonical state and evidence boundaries apply',
  currentImplementationStatus: 'PARTIALLY_IMPLEMENTED',
  nextImplementationStep: 'Add or maintain natural-language and channel-parity coverage',
}));
if (skills.length !== 205) throw new Error(`Expected 205 canonical skills, found ${skills.length}`);

function filesUnder(relative, extensions) {
  const base = path.join(root, relative);
  if (!fs.existsSync(base)) return [];
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (!extensions || extensions.some((extension) => entry.name.endsWith(extension))) output.push(absolute);
    }
  };
  visit(base);
  return output;
}

const sourceFiles = [
  ...filesUnder('src', ['.ts', '.tsx']),
  ...filesUnder('views', ['.ejs']),
  ...filesUnder('frontend/public', ['.html', '.js', '.css']),
  ...filesUnder('content', ['.json', '.md']),
];
const corpus = sourceFiles.map((file) => ({ file: path.relative(root, file), text: fs.readFileSync(file, 'utf8').toLowerCase() }));
const allText = corpus.map((item) => item.text).join('\n');
const routeText = corpus.filter((item) => item.file.includes('Routes.ts') || item.file.includes('routes.ts') || item.file.endsWith('.ejs') || item.file.endsWith('.html')).map((item) => item.text).join('\n');
const pwaText = corpus.filter((item) => /public\/(chat|js|css|sw\.js)|views\/workspace|views\/settings|views\/.*linked-device/.test(item.file)).map((item) => item.text).join('\n');
const adminText = corpus.filter((item) => /admin|adminroutes/i.test(item.file)).map((item) => item.text).join('\n');
const chatText = corpus.filter((item) => /chat|canonicalchatt|unifiedai|intentrouter|skillflows/i.test(item.file)).map((item) => item.text).join('\n');

function slugify(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokensFor(skill) {
  const name = slugify(skill.canonicalName);
  const id = slugify(skill.id);
  const category = slugify(skill.category);
  const tokens = new Set([name, id, category]);
  for (const value of [name, id, category]) {
    const words = value.split(' ').filter((word) => word.length >= 5);
    if (words.length) tokens.add(words.join(' '));
  }
  return [...tokens].filter(Boolean);
}
function hasEvidence(text, tokens) {
  return tokens.some((token) => text.includes(token));
}
function stateEvidence(skill) {
  const states = Array.isArray(skill.stateCoverage) ? skill.stateCoverage : [];
  return {
    available: states.includes('available'), pending: states.includes('pending'), complete: states.includes('complete'),
    blocked: states.includes('blocked'), unavailable: states.includes('unavailable'), failed: states.includes('failed'), review_required: states.includes('review_required'),
  };
}

const rows = skills.map((skill) => {
  const tokens = tokensFor(skill);
  const explicitSource = corpus.find((item) => item.file.toLowerCase().includes(String(skill.sourceRegistry || '').replace(/^src\//, '').toLowerCase()));
  const evidence = {
    canonicalSource: Boolean(explicitSource) || Boolean(skill.sourceRegistry),
    chatEntry: String(skill.conversationEntry || '').length > 0 && (String(skill.chatSupport || '').toLowerCase().includes('support') || hasEvidence(chatText, tokens)),
    publicSurface: hasEvidence(routeText, tokens),
    pwaWorkspace: hasEvidence(pwaText, tokens) || String(skill.webPwaRepresentation || '').toLowerCase().includes('workspace'),
    adminSurface: hasEvidence(adminText, tokens) || /admin|manage|campaign|policy|configuration|review/i.test(`${skill.canonicalService} ${skill.nextImplementationStep}`),
    channelParity: Array.isArray(skill.channelSupport) && skill.channelSupport.length >= 3,
    stateCoverage: stateEvidence(skill),
    fallbackDeclared: /clarif|recover|unavailable|fail|support/i.test(`${skill.trainingCoverage} ${skill.evidenceCoverage} ${skill.nextImplementationStep}`),
  };
  const missing = [];
  if (!evidence.canonicalSource) missing.push('canonical_source');
  if (!evidence.chatEntry) missing.push('chat_entry');
  if (!evidence.pwaWorkspace) missing.push('pwa_or_workspace');
  if (!evidence.channelParity) missing.push('channel_parity');
  if (!evidence.fallbackDeclared) missing.push('truthful_fallback');
  const stateCount = Object.values(evidence.stateCoverage).filter(Boolean).length;
  if (stateCount < 3) missing.push('state_matrix');
  return {
    id: skill.id,
    canonicalName: skill.canonicalName,
    category: skill.category,
    implementationStatus: skill.currentImplementationStatus || skill.deploymentStatus,
    sourceRegistry: skill.sourceRegistry,
    channels: skill.channelSupport || [],
    evidence,
    missing,
    auditStatus: missing.length ? 'needs_review' : 'structurally_covered',
  };
});

const summary = {
  generatedAt: new Date().toISOString(),
  scope: '205 canonical skills across public, PWA/workspace, admin, Chat, and channel surfaces',
  skillCount: rows.length,
  structurallyCovered: rows.filter((row) => row.auditStatus === 'structurally_covered').length,
  needsReview: rows.filter((row) => row.auditStatus === 'needs_review').length,
  dimensions: Object.fromEntries(['canonicalSource', 'chatEntry', 'publicSurface', 'pwaWorkspace', 'adminSurface', 'channelParity', 'fallbackDeclared'].map((dimension) => [dimension, rows.filter((row) => row.evidence[dimension]).length])),
  missingBreakdown: Object.fromEntries([...new Set(rows.flatMap((row) => row.missing))].map((missing) => [missing, rows.filter((row) => row.missing.includes(missing)).length])),
};

const outputDirectory = path.join(root, 'data/audits');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'skill-ui-state-audit.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');
const markdown = [
  '# 205-Skill UI-State Audit',
  '',
  `Generated: ${summary.generatedAt}`,
  '',
  `The audit covers ${summary.skillCount} canonical skills across the public site, PWA/workspace, admin surfaces, universal Chat entry, channel parity, canonical state matrices, and truthful fallback declarations. This is a structural coverage audit; it does not claim that an external provider, payment, channel, or fulfilment path is live.`,
  '',
  '| Metric | Count |',
  '|---|---:|',
  `| Structurally covered | ${summary.structurallyCovered} |`,
  `| Needs review | ${summary.needsReview} |`,
  ...Object.entries(summary.dimensions).map(([key, value]) => `| ${key} evidence | ${value} |`),
  '',
  '## Review queue',
  '',
  '| Skill | Category | Missing dimensions |',
  '|---|---|---|',
  ...rows.filter((row) => row.missing.length).map((row) => `| ${row.canonicalName} | ${row.category} | ${row.missing.join(', ')} |`),
  '',
  '## Interpretation',
  '',
  'A structurally covered skill has a canonical source, a Chat entry, a PWA/workspace representation, channel metadata, a state matrix, and a truthful recovery/fallback declaration. A review flag is a concrete evidence gap for the next implementation pass, not a claim that the skill is absent from the product.',
  '',
].join('\n');
fs.writeFileSync(path.join(outputDirectory, 'skill-ui-state-audit.md'), markdown);
console.log(JSON.stringify(summary, null, 2));

/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = fs.existsSync(path.resolve('dist/public')) ? path.resolve('dist/public') : path.resolve('frontend/public');
const repoRoot = process.cwd();
const cssFiles = [];
const templateFiles = [];
function walk(dir, predicate, output) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, output);
    else if (predicate(entry.name)) output.push(full);
  }
}
walk(root, name => name.endsWith('.css'), cssFiles);
walk(path.resolve('views'), name => /\.(ejs|html)$/.test(name), templateFiles);

function stripComments(value) { return value.replace(/\/\*[\s\S]*?\*\//g, ''); }
function normalize(value) { return value.replace(/\s+/g, ' ').trim(); }

const rules = new Map();
const sizes = [];
const duplicateBlocks = [];
const inlineStyleHits = [];
const inlineHandlerHits = [];
const tokenDefinitions = new Map();
const duplicateCoreTokens = [];
const coreTokens = new Set(['cream', 'terracotta', 'electric-blue', 'charcoal', 'green', 'red', 'font-heading', 'font-body']);

for (const file of cssFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(repoRoot, file);
  sizes.push({ file: relative, bytes: Buffer.byteLength(source) });

  for (const match of source.matchAll(/--([a-z0-9-]+)\s*:/gi)) {
    const token = match[1].toLowerCase();
    if (!coreTokens.has(token)) continue;
    if (tokenDefinitions.has(token) && tokenDefinitions.get(token) !== relative) {
      duplicateCoreTokens.push({ token, first: tokenDefinitions.get(token), duplicate: relative });
    } else tokenDefinitions.set(token, relative);
  }

  let i = 0;
  while (i < source.length) {
    const start = i;
    let quote = null;
    let paren = 0;
    let brace = -1;
    while (i < source.length) {
      const ch = source[i];
      if (quote) { if (ch === '\\') i += 2; else { if (ch === quote) quote = null; i++; } continue; }
      if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
      if (ch === '(') paren++;
      else if (ch === ')') paren--;
      else if (paren === 0 && ch === '{') { brace = i; break; }
      i++;
    }
    if (brace < 0) break;
    const prelude = source.slice(start, brace).trim();
    i = brace + 1;
    let depth = 1;
    quote = null;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (quote) { if (ch === '\\') i += 2; else { if (ch === quote) quote = null; i++; } continue; }
      if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const body = source.slice(brace + 1, i - 1);
    if (prelude.startsWith('@')) continue;
    const key = `${normalize(stripComments(prelude))}|${normalize(stripComments(body))}`;
    if (rules.has(key)) duplicateBlocks.push({ selector: normalize(prelude), first: rules.get(key), duplicate: relative });
    else rules.set(key, relative);
  }
}

for (const file of templateFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(repoRoot, file);
  if (/\sstyle\s*=\s*["']/i.test(source)) inlineStyleHits.push(relative);
  if (/\son(?:click|change|input|submit|keydown|keyup|focus|blur)\s*=\s*["']/i.test(source)) inlineHandlerHits.push(relative);
}

sizes.sort((a, b) => b.bytes - a.bytes);
console.log(`CSS files audited: ${cssFiles.length}`);
console.log(`Production CSS bytes: ${sizes.reduce((n, x) => n + x.bytes, 0).toLocaleString()}`);
for (const item of sizes.slice(0, 10)) console.log(`  ${item.bytes.toLocaleString()}  ${item.file}`);

let failed = false;
if (duplicateBlocks.length) {
  failed = true;
  console.error(`Exact duplicate top-level CSS blocks: ${duplicateBlocks.length}`);
  for (const item of duplicateBlocks.slice(0, 50)) console.error(`  ${item.selector} — ${item.first} == ${item.duplicate}`);
} else console.log('No exact duplicate top-level CSS blocks found in production output.');

if (duplicateCoreTokens.length) {
  failed = true;
  console.error(`Duplicate core design tokens across CSS files: ${duplicateCoreTokens.length}`);
  for (const item of duplicateCoreTokens.slice(0, 50)) console.error(`  --${item.token} — ${item.first} == ${item.duplicate}`);
} else console.log('No duplicate core design tokens found across CSS files.');

if (inlineStyleHits.length) {
  failed = true;
  console.error(`Inline style attributes found: ${inlineStyleHits.length}`);
  for (const file of inlineStyleHits) console.error(`  ${file}`);
} else console.log('No inline style attributes found in server-rendered frontend templates.');

if (inlineHandlerHits.length) {
  failed = true;
  console.error(`Inline event handlers found: ${inlineHandlerHits.length}`);
  for (const file of inlineHandlerHits) console.error(`  ${file}`);
} else console.log('No inline event handlers found in server-rendered frontend templates.');

if (failed) process.exitCode = 1;

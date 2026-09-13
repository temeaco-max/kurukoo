/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'fs';

const css = fs.readFileSync('frontend/public/css/site.css', 'utf8');

// Parse CSS with AST-like tokenizer
function tokenize(input) {
  let pos = 0;
  const len = input.length;
  let line = 1;
  let col = 1;
  const tokens = [];

  while (pos < len) {
    const c = input[pos];

    if (c === '\n') {
      line++;
      col = 1;
      pos++;
      continue;
    }

    if (c === '/' && input[pos + 1] === '*') {
      const startLine = line;
      pos += 2;
      while (pos < len && !(input[pos] === '*' && input[pos + 1] === '/')) {
        if (input[pos] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        pos++;
      }
      pos += 2;
      continue;
    }

    if (/\s/.test(c)) {
      pos++;
      col++;
      continue;
    }

    let token = '';
    const startLine = line;
    const startCol = col;

    if (c === '{' || c === '}' || c === ';' || c === ':') {
      tokens.push({ type: c, value: c, line: startLine, col: startCol });
      pos++;
      col++;
      continue;
    }

    // Read string or identifier/block until special char
    let inString = false;
    let stringChar = '';

    while (pos < len) {
      const ch = input[pos];
      if (ch === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }

      if (!inString && (ch === '"' || ch === "'")) {
        inString = true;
        stringChar = ch;
        token += ch;
        pos++;
        continue;
      }

      if (inString) {
        token += ch;
        if (ch === stringChar && input[pos - 1] !== '\\') {
          inString = false;
        }
        pos++;
        continue;
      }

      if (ch === '{' || ch === '}' || ch === ';' || ch === ':' || (ch === '/' && input[pos + 1] === '*')) {
        break;
      }

      token += ch;
      pos++;
    }

    if (token.trim()) {
      tokens.push({ type: 'text', value: token.trim(), line: startLine, col: startCol });
    }
  }

  return tokens;
}

// Extract rules
function parseRules(input) {
  const rules = [];
  const lines = input.split('\n');

  let inComment = false;
  let stack = [];
  let buffer = '';
  let startLine = 1;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const next = input[i + 1];

    if (!inComment && c === '/' && next === '*') {
      inComment = true;
      i++;
      continue;
    }
    if (inComment && c === '*' && next === '/') {
      inComment = false;
      i++;
      continue;
    }
    if (inComment) continue;

    if (c === '{') {
      const header = buffer.trim();
      buffer = '';
      stack.push({ header, startLine });
    } else if (c === '}') {
      const top = stack.pop();
      const body = buffer.trim();
      buffer = '';
      if (top) {
        rules.push({
          parentHeaders: stack.map(s => s.header),
          header: top.header,
          body: body,
          startLine: top.startLine,
          endLine: getLineNumber(input, i)
        });
      }
    } else {
      if (buffer.length === 0) {
        startLine = getLineNumber(input, i);
      }
      buffer += c;
    }
  }

  return rules;
}

function getLineNumber(str, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (str[i] === '\n') line++;
  }
  return line;
}

const parsedRules = parseRules(css);

console.log(`Parsed ${parsedRules.length} rule blocks.`);

// Filter into selectors vs media rules vs keyframes
const styleRules = [];
const keyframeRules = [];
const atRules = [];

for (const r of parsedRules) {
  if (r.header.startsWith('@keyframes') || r.header.startsWith('@-webkit-keyframes')) {
    keyframeRules.push(r);
  } else if (r.header.startsWith('@media') || r.header.startsWith('@supports')) {
    atRules.push(r);
  } else {
    styleRules.push(r);
  }
}

console.log(`Style rules: ${styleRules.length}, Keyframes: ${keyframeRules.length}, Container at-rules: ${atRules.length}`);

// Find duplicate selector definitions
const selectorMap = new Map();

for (const r of styleRules) {
  const context = r.parentHeaders.join(' > ');
  const normalizedSelector = r.header.split(',').map(s => s.trim().replace(/\s+/g, ' ')).sort().join(', ');
  const key = `${context} | ${normalizedSelector}`;

  if (!selectorMap.has(key)) {
    selectorMap.set(key, []);
  }
  selectorMap.get(key).push(r);
}

const duplicateSelectors = [];
for (const [key, items] of selectorMap.entries()) {
  if (items.length > 1) {
    duplicateSelectors.push({ key, items });
  }
}

console.log(`\n========================================`);
console.log(`DUPLICATE SELECTORS: ${duplicateSelectors.length}`);
console.log(`========================================`);

duplicateSelectors.forEach((dup, idx) => {
  console.log(`\n#${idx + 1}: ${dup.key} (${dup.items.length} occurrences)`);
  dup.items.forEach((item, i) => {
    console.log(`  Occurrence ${i + 1} (Lines ~${item.startLine}-${item.endLine}):`);
    console.log(`    ${item.body.replace(/\n\s*/g, ' ')}`);
  });
});

// Check for exact duplicate property bodies (repeated CSS code across different selectors)
const bodyMap = new Map();
for (const r of styleRules) {
  const normalizedBody = r.body
    .split(';')
    .map(p => p.trim())
    .filter(Boolean)
    .sort()
    .join('; ');

  if (!normalizedBody || normalizedBody.length < 15) continue;

  if (!bodyMap.has(normalizedBody)) {
    bodyMap.set(normalizedBody, []);
  }
  bodyMap.get(normalizedBody).push(r);
}

const duplicateBodies = [];
for (const [body, items] of bodyMap.entries()) {
  if (items.length > 1) {
    duplicateBodies.push({ body, items });
  }
}

// Sort by potential saved characters / lines
duplicateBodies.sort((a, b) => (b.body.length * b.items.length) - (a.body.length * a.items.length));

console.log(`\n========================================`);
console.log(`DUPLICATE DECLARATION BODIES (Exact property sets): ${duplicateBodies.length}`);
console.log(`========================================`);

duplicateBodies.slice(0, 30).forEach((dup, idx) => {
  console.log(`\n#${idx + 1}: Shared by ${dup.items.length} selectors [Saved chars: ~${dup.body.length * (dup.items.length - 1)}]:`);
  console.log(`  Body: { ${dup.body} }`);
  console.log(`  Used on selectors:`);
  dup.items.forEach(item => {
    const context = item.parentHeaders.length ? `[${item.parentHeaders.join(' > ')}] ` : '';
    console.log(`    - ${context}${item.header} (Line ${item.startLine})`);
  });
});

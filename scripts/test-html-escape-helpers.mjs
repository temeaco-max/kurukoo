/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = [
  'frontend/public/js/kurukoo-primary-chat.js',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const hasAmp = source.includes("'&': '&amp;'") || source.includes('"&: "&amp;"') || source.includes("'&':'&amp;'") || source.includes('"&":"&amp;"');
  const hasLt = source.includes("'<': '&lt;'") || source.includes('"<": "&lt;"') || source.includes("'<':'&lt;'") || source.includes('"<":"&lt;"');
  assert.ok(hasAmp && hasLt, `${file} must map & and < to HTML entities in escape helpers`);
  assert.ok(!source.includes("'&': '&'") && !source.includes('"&: "&"'), `${file} must not identity-map &`);
  assert.ok(!source.includes("'<': '<'") && !source.includes('"<": "<"'), `${file} must not identity-map <`);
}

console.log(`HTML escape helper contract passed for ${files.length} client file(s).`);

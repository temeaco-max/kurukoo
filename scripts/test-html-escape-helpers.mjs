import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = [
  'public/js/kurukoo-desk-data.js',
  'public/js/kurukoo-notifications-convergence.js',
  'public/js/kurukoo-memory-convergence.js',
  'public/js/kurukoo-tasks-convergence.js',
  'public/js/kurukoo-contacts-convergence.js',
];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const hasAmp = source.includes("'&': '&amp;'") || source.includes('"&": "&amp;"') || source.includes("'&':'&amp;'") || source.includes('"&":"&amp;"');
  const hasLt = source.includes("'<': '&lt;'") || source.includes('"<": "&lt;"') || source.includes("'<':'&lt;'") || source.includes('"<":"&lt;"');
  assert.ok(hasAmp && hasLt, `${file} must map & and < to HTML entities in escape helpers`);
  // Reject identity mappings for & and <
  assert.ok(!source.includes("'&': '&'") && !source.includes('"&": "&"'), `${file} must not identity-map &`);
  assert.ok(!source.includes("'<': '<'") && !source.includes('"<": "<"'), `${file} must not identity-map <`);
}

console.log(`HTML escape helper contract passed for ${files.length} client files.`);

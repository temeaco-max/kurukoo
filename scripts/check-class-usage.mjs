/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync('frontend/public/css/site.css', 'utf8');

// Let's analyze the exact duplicates in site.css
// 1. Exact Duplicate Selectors (Same Selector defined multiple times)
// 2. Audit Retrofit duplicate rules (lines 1705-1950)
// 3. Navigation duplicate rules (lines 2037-2065 vs 2205-2313)
// 4. Phone Mockup duplicate rules in @media (max-width: 768px)
// 5. Utility class duplicates (lines 870-886 vs 4652-4700)
// 6. Onboarding semantic vs auto-extracted duplicates (lines 5016-5190 vs 5200-5713)
// 7. Duplicate Keyframe animations
// 8. Unused / redundant auto-extracted classes

console.log('Analyzing CSS Duplication...');

// Check HTML and EJS references to onboard-st-*, viewslegalejs-st-*, publicdashboardhtml-st-*, etc.
const viewsDir = 'views';
const publicDir = 'public';

function getFiles(dir, exts = ['.ejs', '.html', '.js', '.ts']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const full = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(getFiles(full, exts));
    } else if (exts.includes(path.extname(file.name))) {
      results.push(full);
    }
  }
  return results;
}

const allFiles = [...getFiles('views'), ...getFiles('public'), ...getFiles('src')];
const fileContents = allFiles.map(f => ({ path: f, content: fs.readFileSync(f, 'utf8') }));

function countUsage(className) {
  let count = 0;
  for (const f of fileContents) {
    if (f.content.includes(className)) {
      count++;
    }
  }
  return count;
}

// Check onboard-st classes vs semantic classes
console.log('\n--- Checking Onboarding Classes Usage ---');
const onboardSemantic = [
  'onboard-radio-label', 'selfhosted-wa-section', 'selfhosted-wa-title', 'selfhosted-wa-desc',
  'selfhosted-fields', 'sh-label', 'sh-input', 'sh-assisted-card', 'sh-assisted-desc',
  'onboard-submit-btn', 'ussd-success-title', 'ussd-dial-box', 'ussd-code-text',
  'ussd-dial-btn', 'onboard-dismiss-btn'
];

for (let i = 1; i <= 70; i++) {
  const stClass = `onboard-st-${i}`;
  const usage = countUsage(stClass);
  if (usage > 0) {
    // console.log(`${stClass} is used in ${usage} files`);
  }
}

onboardSemantic.forEach(cls => {
  console.log(`Semantic class .${cls}: used in ${countUsage(cls)} files`);
});

// Check viewslegalejs-st-* usage
console.log('\n--- Checking viewslegalejs-st-* Usage ---');
for (let i = 1; i <= 20; i++) {
  const stClass = `viewslegalejs-st-${i}`;
  const usage = countUsage(stClass);
  if (usage > 0) {
    console.log(`${stClass} is used in ${usage} files`);
  }
}

// Check publicdashboardhtml-st-* usage
console.log('\n--- Checking publicdashboardhtml-st-* Usage ---');
let dashUsed = 0;
for (let i = 1; i <= 100; i++) {
  const stClass = `publicdashboardhtml-st-${i}`;
  const usage = countUsage(stClass);
  if (usage > 0) dashUsed++;
}
console.log(`publicdashboardhtml-st-* classes used: ${dashUsed} / 100 checked`);

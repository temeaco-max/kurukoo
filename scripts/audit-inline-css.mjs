/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'fs';
import path from 'path';

const TARGET_DIRS = ['views', 'frontend/public'];
const FILE_EXTENSIONS = ['.ejs', '.html', '.js'];

// Regex patterns to detect inline styles
const INLINE_STYLE_ATTR_REGEX = /style\s*=\s*(["'])[\s\S]*?\1/gi;
const INLINE_STYLE_TAG_REGEX = /<style[\s\S]*?>[\s\S]*?<\/style>/gi;

let totalViolations = 0;
const violationsReport = [];

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (FILE_EXTENSIONS.includes(ext)) {
        auditFile(fullPath);
      }
    }
  }
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileViolations = [];

  lines.forEach((line, index) => {
    // Ignore inline styles inside inline SVGs if needed, but flag standard HTML/JS inline styles
    let match;
    const lineNum = index + 1;

    // Check for style="..." attributes
    INLINE_STYLE_ATTR_REGEX.lastIndex = 0;
    while ((match = INLINE_STYLE_ATTR_REGEX.exec(line)) !== null) {
      // Exclude dynamic SVG attributes or intentional dynamic JS style sets if strictly needed
      fileViolations.push({
        line: lineNum,
        type: 'style-attribute',
        match: match[0],
        context: line.trim()
      });
    }

    // Check for <style> tags
    INLINE_STYLE_TAG_REGEX.lastIndex = 0;
    while ((match = INLINE_STYLE_TAG_REGEX.exec(line)) !== null) {
      fileViolations.push({
        line: lineNum,
        type: 'style-tag',
        match: match[0],
        context: line.trim()
      });
    }
  });

  if (fileViolations.length > 0) {
    totalViolations += fileViolations.length;
    violationsReport.push({ filePath, violations: fileViolations });
  }
}

console.log('🔍 Starting Frontend Inline CSS Audit...\n');

for (const dir of TARGET_DIRS) {
  scanDirectory(dir);
}

if (totalViolations === 0) {
  console.log('✅ Audit Passed: No inline CSS attributes or <style> tags found in frontend files!');
  process.exit(0);
} else {
  console.log(`❌ Audit Failed: Found ${totalViolations} inline CSS violation(s) across ${violationsReport.length} file(s):\n`);

  for (const report of violationsReport) {
    console.log(`📁 File: ${report.filePath}`);
    for (const v of report.violations) {
      console.log(`   Line ${v.line} [${v.type}]: ${v.match}`);
      console.log(`   └─ ${v.context.slice(0, 100)}...`);
    }
    console.log('');
  }

  console.log('⚠️ Please move inline styles to global CSS in /public/css/site.css or corresponding stylesheets.');
  // Exit with non-zero code when run as strict check script
  if (process.argv.includes('--strict')) {
    process.exit(1);
  }
}

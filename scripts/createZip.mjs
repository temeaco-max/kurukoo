/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const zip = new AdmZip();

const filesAndDirs = [
    'src',
    'frontend/public',
    'views',
    'locales',
    'models',
    'scripts',
    'package.json',
    'tsconfig.json',
    'metadata.json',
    'kurukoo.sqlite',
    'README.md'
];

for (const item of filesAndDirs) {
    const fullPath = path.join(process.cwd(), item);
    if (!fs.existsSync(fullPath)) continue;
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
        zip.addLocalFolder(fullPath, item);
    } else {
        zip.addLocalFile(fullPath);
    }
}

const outputPath = path.join(process.cwd(), 'kurukoo-complete-final.zip');
zip.writeZip(outputPath);
console.log(`Successfully generated: ${outputPath}`);

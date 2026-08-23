import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const canonical = new Set(['src/database.ts','src/services/canonicalStore.ts','src/services/postgresPersistence.ts']);
const direct=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()&&file.endsWith('.ts')){const rel=path.relative(process.cwd(),file).replaceAll(path.sep,'/');if(canonical.has(rel))continue;const source=fs.readFileSync(file,'utf8');if(/from\s+['"][^'"]*database\.js['"]/.test(source)||/\bgetDb\s*\(/.test(source)||/\bsaveDb\s*\(/.test(source))direct.push({path:rel,importDatabase:/from\s+['"][^'"]*database\.js['"]/.test(source),getDb:/\bgetDb\s*\(/.test(source),saveDb:/\bsaveDb\s*\(/.test(source)});}}}
walk(root);
const allowed=[/^src\/services\/.*(?:cache|rateLimit|inMemory|processLocal).*$/i,/^src\/.*(?:test|fixture|mock|seed).*$/i];
const classified=direct.map(file=>({...file,classification:allowed.some(rule=>rule.test(file.path))?'explicit-nonauthoritative':'productionReview'}));
const blocking=classified.filter(file=>file.classification==='productionReview');
console.log(JSON.stringify({status:blocking.length?'blocked':'verified',directSqljsFiles:classified.sort((a,b)=>a.path.localeCompare(b.path)),blockingProductionEdges:blocking,counts:{direct:classified.length,blocking:blocking.length},policy:'Canonical durable application state must use kurukoo-persistence. Direct database.js/getDb/saveDb access is permitted only to the canonical backend owner or explicitly non-authoritative tooling/process-local code. Every productionReview edge blocks PostgreSQL application integration.'},null,2));
process.exit(blocking.length?1:0);

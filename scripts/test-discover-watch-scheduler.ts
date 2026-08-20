import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../src/startup/backgroundServices.ts', import.meta.url), 'utf8');
assert.match(source, /import \{ processDiscoverWatches \} from '..\/services\/discoverExperience\.js';/, 'active startup scheduler must import the canonical Discover Watch processor');
assert.match(source, /KURUKOO_DISCOVER_WATCH_INTERVAL_SEC/, 'Discover Watch must expose an explicit bounded interval configuration');
assert.match(source, /processDiscoverWatches\(100\)/, 'active startup scheduler must run the canonical bounded Watch pass');
assert.match(source, /initial Discover Watch pass/, 'active startup scheduler must initialize Watch processing after startup');
assert.doesNotMatch(source, /startBackgroundWorkers/, 'active startup scheduler must not revive the unused legacy background worker');
console.log('Discover Watch scheduler regression passed: canonical Watch processing is wired through the active startup lifecycle.');

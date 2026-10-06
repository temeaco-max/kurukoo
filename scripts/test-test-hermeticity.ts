/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/* Contract: a contract must never read — or delete — the database path its
 * environment happens to provide. (AGENTS.md §66.1)
 *
 * WHY THIS EXISTS
 * `.env` sets `DB_PATH=tmp/kurukoo.sqlite`, and a running dev server exports it.
 * Two contracts here read it with `||` and then deleted it:
 *
 *   const dbPath = process.env.DB_PATH || '/tmp/kurukoo-behavioral-matrix.sqlite';
 *   try { fs.rmSync(dbPath, { force: true }); } catch {}
 *
 * The fallback never fires in a developer's shell, so `rmSync` received the real
 * development database and deleted it before the first assertion ran. Proven
 * with a canary: with `DB_PATH` pointing at a file, running those two lines
 * removed it. That is not a flaky test, it is data loss.
 *
 * Three more used `||` without deleting. They were merely non-hermetic: they
 * silently reused the shared database, so state accumulated until a correct
 * assertion failed on someone else's data.
 *
 * This guards the CLASS, not those files, so the pattern cannot return in a
 * sixth contract. `production-preflight.mjs` is excluded on purpose: reading
 * DB_PATH there is its job, because it inspects the deployment's real config.
 *
 * DIRECTORY NOTE
 * Both `scripts/` and `test/` are scanned. Contracts live in both, and a guard
 * that reads one directory cannot see the other half of the suite.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SRC_DIR = path.join(root, 'src');

/** Contract files that RUN AS TESTS, in both directories. */
function testFiles(): { dir: string; file: string }[] {
  const out: { dir: string; file: string }[] = [];
  const scriptsDir = path.join(root, 'scripts');
  const testDir = path.join(root, 'test');
  if (fs.existsSync(scriptsDir)) {
    for (const file of fs.readdirSync(scriptsDir)) {
      if (/^test-.*\.(ts|mjs)$/.test(file)) out.push({ dir: scriptsDir, file });
    }
  }
  if (fs.existsSync(testDir)) {
    // `test/` convention is `*.test.ts`, NOT `^test`, which misses every one.
    for (const file of fs.readdirSync(testDir)) {
      if (/\.test\.ts$/.test(file)) out.push({ dir: testDir, file });
    }
  }
  return out;
}

/** Stable label so an entry means the same thing in both directories. */
function label(dir: string, file: string): string {
  return path.basename(dir) === 'test' ? `test/${file}` : file;
}

/** Strip comments so a contract DOCUMENTING the old pattern is not flagged. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Resolve a relative import specifier to a real source file. */
function resolveRelative(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const candidate = path.resolve(path.dirname(fromFile), spec).replace(/\.js$/, '.ts');
  return fs.existsSync(candidate) ? candidate : null;
}

const IMPORT_SPEC = /(?:from\s+|import\(\s*)['"](\.[^'"]*)['"]/g;

/** Static (hoisted) imports only — ESM evaluates these before any statement. */
const STATIC_SPEC =
  /(?:^|\n)\s*import\s+(?!type\s)(?:[^'"]*?\s+from\s+)?['"](\.[^'"]*)['"]/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/**
 * Every src module that reaches `src/database.ts`, computed from the real
 * import graph rather than guessed. "Imports src/" alone is far too broad — it
 * reported 171 files, most of which never touch the store, and a backlog nobody
 * can act on protects nothing.
 */
function databaseReachingModules(): Set<string> {
  const importers = new Map<string, string[]>();
  for (const file of sourceFiles(SRC_DIR)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(IMPORT_SPEC)) {
      const target = resolveRelative(file, match[1]);
      if (!target) continue;
      const list = importers.get(target);
      if (list) list.push(file);
      else importers.set(target, [file]);
    }
  }
  // Seed with `database.ts` ITSELF, not just its importers. Without this a
  // contract that imports `src/database.ts` directly — the most direct way to
  // boot the store, and the easiest to get wrong — is not in the closure and
  // therefore invisible to rule 3. Measured: the probe below passed because of
  // exactly this omission.
  const reaches = new Set<string>([path.join(SRC_DIR, 'database.ts')]);
  const queue = [path.join(SRC_DIR, 'database.ts')];
  while (queue.length) {
    for (const importer of importers.get(queue.pop()!) ?? []) {
      if (reaches.has(importer)) continue;
      reaches.add(importer);
      queue.push(importer);
    }
  }
  return reaches;
}

const reachesDatabase = databaseReachingModules();
const failures: string[] = [];
const BASELINE_FILE = path.join(root, '.agents/baselines/hermeticity-baseline.txt');

for (const { dir, file } of testFiles()) {
  // This contract quotes the very patterns it forbids in its failure messages,
  // so scanning it would make it fail on its own output. A guard that cannot
  // pass is not a guard.
  if (file === 'test-test-hermeticity.ts') continue;
  const name = label(dir, file);
  const source = code(fs.readFileSync(path.join(dir, file), 'utf8'));
  const filePath = path.join(dir, file);

  // 1. Reading the environment to decide where data lives. The `||` is the
  //    defect: it makes the contract inherit a developer's real database.
  if (/process\.env\.DB_PATH\s*\|\|/.test(source)) {
    failures.push(
      `${name}: uses process.env.DB_PATH || … — a contract must assign its own path unconditionally`,
    );
  }

  const deletesSomething = /rmSync\(\s*(dbPath|process\.env\.DB_PATH)/.test(source);
  const deletesEnvDirectly = /rmSync\(\s*process\.env\.DB_PATH/.test(source);
  // A delete is only dangerous when the path ORIGINATED in the environment.
  // rmSync(dbPath) is CORRECT when dbPath was assigned unconditionally above.
  const assignsOwnPath = /process\.env\.DB_PATH\s*=\s*[^;]*(?:\$\{|`)/.test(source);
  const dbPathFromEnv =
    /(?:const|let|var)\s+dbPath\s*=\s*process\.env\.DB_PATH\b/.test(source) &&
    !/(?:const|let|var)\s+dbPath\s*=\s*`/.test(source);

  if (deletesSomething && deletesEnvDirectly && !assignsOwnPath) {
    failures.push(
      `${name}: deletes process.env.DB_PATH without ever assigning its own — it can destroy the developer's real database`,
    );
  }
  if (deletesSomething && dbPathFromEnv && !assignsOwnPath) {
    failures.push(
      `${name}: deletes a path derived from the environment — it can destroy the developer's real database`,
    );
  }

  // 2. Deleting a path that is not unique per run. `Date.now()`/`process.pid`
  //    make it the contract's own; a fixed shared name collides and may not be
  //    the contract's to delete.
  if (/rmSync\(/.test(source)) {
    if (!/Date\.now\(\)|process\.pid/.test(source)) {
      if (
        /rmSync\(\s*['"`]\/tmp\/[^'"`]*\.(sqlite|db)['"`]/.test(source) ||
        /rmSync\(\s*dbPath/.test(source)
      ) {
        failures.push(
          `${name}: deletes a path that is not unique per run — repeated runs collide, and it may be a shared database`,
        );
      }
    }
  }

  // 3. Absence is a violation, not an exemption. A contract that assigns
  //    NOTHING looks perfectly clean in review, and that is exactly the one
  //    that will inherit — or destroy — whatever tmp/kurukoo.sqlite holds.
  //    Rule 1 can only catch a file that NAMES the variable, so it is blind to
  //    every contract that never mentions it. This is the rule that closes
  //    that gap: import an owner that reaches the store, and never assign.
  if (/process\.env\.DB_PATH\s*=/.test(source)) continue;
  const boots = [...source.matchAll(IMPORT_SPEC)].some((match) => {
    const target = resolveRelative(filePath, match[1]);
    return target !== null && reachesDatabase.has(target);
  });
  if (boots) {
    failures.push(
      `${name}: imports a module that reaches the database but never assigns DB_PATH — ` +
        "it will use the ambient database, which means a developer's real one. " +
        'Assign a per-run path before the first import.',
    );
  }

  // 4. The silent no-op. `src/database.ts` captures its path at MODULE LOAD,
  //    and ESM evaluates static imports before any statement in the importing
  //    module. So a file that statically imports a store-reaching owner and
  //    only then assigns DB_PATH has its assignment accepted and ignored — it
  //    looks fixed and is not. Proven with a canary file rather than reasoned
  //    about: the assigned path never appeared and the ambient one was written.
  //    The remedy is to make the import dynamic, not to move the assignment.
  const staticReaches = [...source.matchAll(STATIC_SPEC)]
    .map((match) => resolveRelative(filePath, match[1]))
    .filter((target) => target !== null && reachesDatabase.has(target));
  if (staticReaches.length) {
    failures.push(
      `${name}: statically imports a module that reaches the database — DB_PATH must be ` +
        'assigned before the store loads, and ESM hoists static imports above every ' +
        `statement, so an assignment in this file is ignored (via ${[
          ...new Set(staticReaches.map((t) => path.relative(root, t!))),
        ].join(', ')}). Use a dynamic import.`,
    );
  }
}

/**
 * This is a RATCHET, not a gate.
 *
 * The class is large: 210 pre-existing contracts reach the store without
 * assigning a path. A gate that fails 210 on the day it is written blocks every
 * unrelated contract in the repository, which protects nothing and gets
 * deleted. So the recorded backlog is treated as known debt — reported every
 * run, never failing — and only a violation that is NOT in the baseline fails.
 *
 * The debt is now paid: the backlog is empty. An absent baseline is therefore
 * the normal state rather than a failure, so a fresh clone reads as clean.
 * `.agents/` is gitignored, so the baseline is deliberately untracked.
 *
 * Paying the debt down shrinks the baseline; `--prune` drops entries that are no
 * longer violations so the number stays an honest count of what is left rather
 * than drifting into a permanent allowlist.
 */
function loadBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_FILE)) return new Set();
  return new Set(fs.readFileSync(BASELINE_FILE, 'utf8').split('\n').filter(Boolean));
}

function reportStale(current: string[]): void {
  const live = new Set(current);
  const stale = [...loadBaseline()].filter((entry) => !live.has(entry));
  if (!stale.length) return;
  console.log(
    `Baseline: ${stale.length} entr(ies) are no longer violations (someone fixed them). ` +
      'Run `npm run test:hermeticity -- --prune` to drop them:',
  );
  for (const entry of stale) console.log(`  - ${entry}`);
}

const reportOnly = process.argv.includes('--report');
const pruneOnly = process.argv.includes('--prune');

if (pruneOnly) {
  const current = new Set(failures);
  const entries = loadBaseline();
  const kept = [...entries].filter((entry) => current.has(entry));
  const dropped = [...entries].filter((entry) => !current.has(entry));
  if (!dropped.length) {
    console.log('Nothing to prune: every baseline entry is still a live violation.');
  } else {
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, kept.join('\n') + (kept.length ? '\n' : ''));
    console.log(`Pruned ${dropped.length} baseline entr(ies) that are no longer violations:`);
    for (const entry of dropped) console.log(`  - ${entry}`);
  }
  process.exit(0);
}

if (reportOnly) {
  console.log(`Test hermeticity backlog: ${failures.length} pre-existing violation(s).`);
  for (const failure of failures) console.log(`- ${failure}`);
  reportStale(failures);
  process.exit(0);
}

const baseline = loadBaseline();
const regressions = failures.filter((failure) => !baseline.has(failure));

if (regressions.length) {
  console.error('Test hermeticity contract failed — NEW violations since the baseline:');
  for (const regression of regressions) console.error(`- ${regression}`);
  process.exit(1);
}

console.log(
  `Test hermeticity contract passed: no new violations across ${testFiles().length} contracts. ` +
    `Known pre-existing backlog: ${failures.length} (run \`npm run test:hermeticity -- --report\`).`,
);
reportStale(failures);
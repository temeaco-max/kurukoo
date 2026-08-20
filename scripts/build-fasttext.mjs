import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const modelsDir = path.join(root, 'models');
const baseTrainingPath = path.join(modelsDir, 'intent_training_data.txt');
const mergedTrainingPath = path.join(modelsDir, '.intent_training_data.merged.txt');
const trainTrainingPath = path.join(modelsDir, '.intent_training_data.train.txt');
const outputBase = path.join(modelsDir, 'kurukoo_intent');
const binaryPath = `${outputBase}.bin`;
const generator = path.join(root, 'scripts', 'generateIntentTrainingData.mjs');
const skillHintGenerator = path.join(root, 'scripts', 'generate-fasttext-skill-hints.ts');
const curatedGenerator = path.join(root, 'scripts', 'generate-fasttext-curated-corpus.ts');
const merger = path.join(root, 'scripts', 'merge-fasttext-corpus.ts');

fs.mkdirSync(modelsDir, { recursive: true });
if (!fs.existsSync(baseTrainingPath) && fs.existsSync(generator)) execFileSync(process.execPath, [generator], { stdio: 'inherit' });
if (fs.existsSync(skillHintGenerator)) execFileSync('npx', ['tsx', skillHintGenerator], { stdio: 'inherit' });
if (fs.existsSync(curatedGenerator)) execFileSync('npx', ['tsx', curatedGenerator], { stdio: 'inherit' });
if (!fs.existsSync(baseTrainingPath)) throw new Error('FastText training data is missing');
if (!fs.existsSync(merger)) throw new Error('FastText corpus merger is missing');
execFileSync('npx', ['tsx', merger], { stdio: 'inherit' });

try {
  execFileSync('fasttext', [
    'supervised', '-input', trainTrainingPath, '-output', outputBase,
    '-lr', '0.75', '-epoch', '80', '-wordNgrams', '2', '-dim', '75',
    '-bucket', '20000', '-minn', '1', '-maxn', '3', '-thread', '1'
  ], { stdio: 'inherit', timeout: 180000 });
} catch (error) {
  console.error('[FastText build] fasttext CLI is unavailable or training failed.');
  process.exitCode = 1;
}

try { fs.unlinkSync(mergedTrainingPath); } catch {}
if (fs.existsSync(binaryPath)) {
  const size = fs.statSync(binaryPath).size;
  if (size < 100) throw new Error(`FastText model is unexpectedly small: ${size} bytes`);
  const vectorPath = `${outputBase}.vec`;
  if (fs.existsSync(vectorPath)) fs.unlinkSync(vectorPath);
  console.log(`[FastText build] model ready: ${binaryPath} (${size} bytes)`);
}

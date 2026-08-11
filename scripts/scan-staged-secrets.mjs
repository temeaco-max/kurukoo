import { execFileSync } from 'node:child_process';

const staged = execFileSync('git', ['diff', '--cached', '--no-ext-diff', '--unified=0'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const additions = staged
  .split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  .map((line) => line.slice(1));

const tokenPatterns = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /(?:sk|gsk|hf)_[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const assignmentPattern = /^\s*[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|API_KEY|PASSWORD|PRIVATE_KEY)\s*=\s*(?!\s*(?:['"])?(?:stub|example|replace_me|your_[a-z_]+|<[^>]+>)(?:['"])?\s*$)\S+/i;
const matches = additions.filter((line) => tokenPatterns.some((pattern) => pattern.test(line)) || assignmentPattern.test(line));

if (matches.length) {
  console.error('Staged changes contain a secret-like value. Remove it from the commit and store it in an ignored environment or secret manager.');
  console.error('No candidate value is printed by this check. The CI Gitleaks scan remains the authoritative repository-wide control.');
  process.exit(1);
}

console.log('Staged secret check passed.');

/** Scan the Git index (the exact content to commit), never print secret values. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const files = git('ls-files', '--full-name', '-z').toString('utf8').split('\0').filter(Boolean);
if (!files.length) throw new Error('No tracked files: stage the intended source first.');
const forbidden = /(^|\/)(node_modules|\.next[^/]*|\.data|uploads|deliverables|test-results[^/]*|playwright-report[^/]*|blob-report|coverage)(\/|$)|\.(?:log|tsbuildinfo|sqlite(?:3)?|db|pem|key|zip|bak)$/i;
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['credential URL', /\b(?:postgres(?:ql)?|mysql|https?):\/\/[^\s/:]+:[^\s/@]+@/],
];
const localSecrets = [];
for (const file of ['.env', '.env.local', '.env.development.local', '.env.production.local']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (value.length >= 12) localSecrets.push(value);
  }
}
const failures = [];
for (const file of files) {
  if (forbidden.test(file) || (/(^|\/)\.env[^/]*$/.test(file) && !file.endsWith('.env.example'))) {
    failures.push(`${file}: private/generated file`);
    continue;
  }
  const blob = git('show', `:${file}`);
  if (blob.includes(0)) {
    if (!/^(?:application\/)?public\/.*\.(?:png|jpe?g|webp|ico)$/i.test(file)) failures.push(`${file}: unreviewed binary`);
    continue;
  }
  const content = blob.toString('utf8');
  // Exact existing negative-test fixture, not a blanket exemption for tests.
  const scanned = file.endsWith('tests/event-board.test.ts')
    ? content.replaceAll('https://' + 'user:pass@' + 'example.com', 'https://example.com')
    : content;
  for (const [label, pattern] of patterns) if (pattern.test(scanned)) failures.push(`${file}: ${label}`);
  if (localSecrets.some(secret => content.includes(secret))) failures.push(`${file}: matches local credential`);
}
if (failures.length) {
  console.error('Repository check failed (values redacted):\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Repository check passed: ${files.length} staged/tracked files; no forbidden paths, known credential patterns or copied local credentials.`);
}

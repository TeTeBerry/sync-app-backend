#!/usr/bin/env node
/**
 * Block commits that add hardcoded secrets to tracked files.
 * Wired via husky pre-commit (before lint-staged).
 */
import { execSync } from 'node:child_process';

const PATTERNS = [
  { name: 'GitHub PAT', re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI-style key', re: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  {
    name: 'private key block',
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

function listStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readStagedDiff(file) {
  try {
    return execSync(`git show :${file}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch {
    return '';
  }
}

const staged = listStagedFiles();
if (staged.length === 0) process.exit(0);

const hits = [];
for (const file of staged) {
  if (file.endsWith('.env') || file.endsWith('.env.production') || file.includes('.env.')) {
    hits.push({ file, pattern: 'env file staged' });
    continue;
  }
  const content = readStagedDiff(file);
  if (!content) continue;
  for (const { name, re } of PATTERNS) {
    if (re.test(content)) hits.push({ file, pattern: name });
  }
}

if (hits.length === 0) process.exit(0);

console.error('Secret scan failed — remove secrets before committing:\n');
for (const { file, pattern } of hits) {
  console.error(`  ${file}: ${pattern}`);
}
console.error('\nUse .env (see .env.example) and keep .env out of git.');
process.exit(1);

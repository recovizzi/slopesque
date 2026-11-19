// Secret scan (the repository is public): gitleaks if installed, else its Docker image, else a small built-in check
// of the usual key formats. `--staged` scans what is about to be committed (git hook), otherwise the whole history.
import { execFileSync, spawnSync } from 'node:child_process';

const staged = process.argv.includes('--staged');
const has = cmd => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
const IMAGE = 'zricethezav/gitleaks:v8.30.1';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

if (has('gitleaks')) run('gitleaks', ['git', '--redact', '--no-banner', ...(staged ? ['--staged', '--pre-commit'] : []), '.']);
if (has('docker') && spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0) {
  run('docker', ['run', '--rm', '-v', `${process.cwd()}:/repo`, '-w', '/repo', IMAGE, 'git', '--redact', '--no-banner',
    ...(staged ? ['--staged', '--pre-commit'] : []), '/repo']);
}

// fallback: the added lines of the staged diff (or of the whole tree)
const text = staged ? execFileSync('git', ['diff', '--cached', '-U0'], { encoding: 'utf8' })
  : execFileSync('git', ['grep', '-I', '-n', '-e', '.', '--', '.'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/user:\d{6,}:\d+/, 'AMO API key'],
  [/(?:secret|password|api[_-]?key|token)\s*[:=]\s*['"]?(?!dev-only-|change-me|<)[A-Za-z0-9_\-+/]{20,}/i, 'secret-looking value'],
];
const found = [];
for (const line of text.split('\n')) {
  if (staged && !line.startsWith('+')) continue;
  for (const [re, what] of PATTERNS) if (re.test(line)) found.push(`${what}: ${line.slice(0, 80)}…`);
}
if (found.length) {
  console.error(`Secret scan (built-in, gitleaks not found): ${found.length} suspect line(s)\n${found.join('\n')}`);
  process.exit(1);
}
console.log('Secret scan (built-in): nothing found.');

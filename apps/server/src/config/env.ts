// Reads the configuration: the process environment, plus in development the repository's .env (or .env.example when
// there is none, so that a fresh clone runs). Production gets its variables from Docker Compose only.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEnv, type Env } from '@slopesque/shared';

/** The repository's root (where pnpm-workspace.yaml is), from the current folder up. */
export function repoRoot(from = process.cwd()): string | null {
  for (let d = from; ; d = dirname(d)) {
    if (existsSync(join(d, 'pnpm-workspace.yaml'))) return d;
    if (dirname(d) === d) return null;
  }
}

export function loadEnv(): Env {
  if (process.env.NODE_ENV !== 'production') {
    const root = repoRoot();
    const file = root && [join(root, '.env'), join(root, '.env.example')].find(f => existsSync(f));
    if (file) process.loadEnvFile(file);   // never overrides a variable already set
  }
  const { env, problems } = parseEnv(process.env);
  if (!env) {
    console.error(`Configuration refusée :\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  return env;
}

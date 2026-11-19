// The configuration the tools see: .env, else .env.example (as the server in development).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname;
export function readEnv() {
  const file = [join(ROOT, '.env'), join(ROOT, '.env.example')].find(f => existsSync(f));
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return { env: { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k in env)) }, file };
}

// `pnpm dev`: the services in Docker (Postgres, Redis, RustFS), the packages built, then everything in watch mode:
// packages, server (migrations at its start) and the web app. Works on a fresh clone, without any key.
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, readEnv } from './env.mjs';

const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT }).status === 0;
const { file } = readEnv();
console.log(`Configuration : ${file.endsWith('.example') ? '.env.example (pas de .env)' : '.env'}`);
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('Docker ne répond pas : lance Docker, puis relance `pnpm dev`.');
  process.exit(1);
}
if (!run('docker', ['compose', '-f', 'infra/docker-compose.yml', 'up', '-d', '--wait'])) process.exit(1);
if (!run('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=./packages/*', '--output-logs=errors-only'])) process.exit(1);
const dev = spawn('pnpm', ['exec', 'turbo', 'run', 'dev', '--filter=./packages/*', '--filter=@slopesque/server', '--filter=@slopesque/web', '--ui=stream'],
  { stdio: 'inherit', cwd: ROOT });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => dev.kill(s));
dev.on('exit', code => process.exit(code ?? 0));

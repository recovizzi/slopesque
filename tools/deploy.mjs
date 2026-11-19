// `pnpm deploy:prod` (`pnpm deploy` is pnpm's own command): the production stack on the project's machine (openspec: repo-and-secrets, Déploiement). Run by you,
// from your machine: SSH to the alias of DEPLOY_SSH_HOST (your ~/.ssh/config, never in the repository), the compose
// file copied there, then — as the deploy account (sudo, you type the password) — the server's image pulled from GHCR
// and the stack restarted. The machine's secrets stay in its own infra/.env (written once, see MANQUES.md).
import { spawnSync } from 'node:child_process';
import { readEnv, ROOT } from './env.mjs';
import { join } from 'node:path';

const { env } = readEnv();
const host = process.env.DEPLOY_SSH_HOST || env.DEPLOY_SSH_HOST ;
const user = process.env.DEPLOY_USER || env.DEPLOY_USER ;
const dir = process.env.DEPLOY_DIR || env.DEPLOY_DIR || 'slopesque';
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit' }); if (r.status !== 0) { console.error(`Échec : ${cmd} ${args.join(' ')}`); process.exit(r.status ?? 1); } };

console.log(`Déploiement sur ${host} (compte ${user}, dossier ~${user}/${dir}). Aucune sauvegarde n'est faite.`);
run('scp', [join(ROOT, 'infra/docker-compose.prod.yml'), `${host}:/tmp/slopesque-compose.yml`]);
const remote = [
  `set -e`, `mkdir -p ~/${dir}/infra`, `cp /tmp/slopesque-compose.yml ~/${dir}/infra/docker-compose.prod.yml`,
  `test -f ~/${dir}/infra/.env || { echo "Il manque ~/${dir}/infra/.env sur la machine (voir MANQUES.md)"; exit 1; }`,
  `cd ~/${dir}/infra`, `docker compose -f docker-compose.prod.yml --env-file .env pull server`,
  `docker compose -f docker-compose.prod.yml --env-file .env up -d --wait`,
  `curl -fs http://127.0.0.1:$(grep -E '^PUBLIC_PORT=' .env | cut -d= -f2)/api/health`,
].join(' && ');
run('ssh', ['-t', host, `chmod 644 /tmp/slopesque-compose.yml && sudo -iu ${user} sh -c '${remote}' && rm -f /tmp/slopesque-compose.yml`]);
console.log('\nDéployé.');

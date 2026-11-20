// `pnpm deploy:prod` (`pnpm deploy` is pnpm's own command): the production stack on the project's machine (openspec: repo-and-secrets, Déploiement). Run by you,
// from your machine: SSH to the alias of DEPLOY_SSH_HOST (your ~/.ssh/config, never in the repository), the compose
// file copied there, then — as the deploy account (sudo, you type the password) — the server's image pulled from GHCR
// and the stack restarted. The machine's secrets stay in its own infra/.env (written once, see MANQUES.md).
import { spawnSync } from 'node:child_process';
import { readEnv, ROOT } from './env.mjs';
import { join } from 'node:path';

// The machine is named only in your .env (git-ignored): its SSH alias, the deploy account. Never in the repository.
const { env } = readEnv();
const host = process.env.DEPLOY_SSH_HOST || env.DEPLOY_SSH_HOST;
const user = process.env.DEPLOY_USER || env.DEPLOY_USER;
const dir = process.env.DEPLOY_DIR || env.DEPLOY_DIR || 'slopesque';
if (!host || !user) { console.error('Il manque DEPLOY_SSH_HOST (ton alias SSH) ou DEPLOY_USER (le compte de déploiement) dans ton .env.'); process.exit(1); }
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit' }); if (r.status !== 0) { console.error(`Échec : ${cmd} ${args.join(' ')}`); process.exit(r.status ?? 1); } };
const quote = s => `'${String(s).replace(/'/g, `'"'"'`)}'`;

// `pnpm prod:admin <commande> [options]`: an admin command in the server's container on the machine (see ADMIN.md)
if (process.argv[2] === 'admin') {
  const args = process.argv.slice(3).map(quote).join(' ');
  if (!args) { console.error('Usage : pnpm prod:admin <commande> [options] (pnpm prod:admin help pour la liste)'); process.exit(1); }
  const inner = `cd ~/${dir}/infra && docker compose -f docker-compose.prod.yml --env-file .env exec -T server admin ${args}`;
  run('ssh', ['-t', host, `sudo -iu ${user} sh -c ${quote(inner)}`]);
  process.exit(0);
}

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

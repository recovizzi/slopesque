// `pnpm deploy:prod [--check] [--init] [--image local|X.Y.Z]` (`pnpm deploy` is pnpm's own command): the production
// stack on the project's machine (openspec: repo-and-secrets, Déploiement), run by you, from your machine, in a terminal.
// The machine is named only in your .env (git-ignored) and your ~/.ssh/config: DEPLOY_SSH_HOST (an SSH alias),
// DEPLOY_USER (the deploy account), DEPLOY_DIR, PROD_PUBLIC_URL, DEPLOY_CADDY_DIR. Never in the repository.
// How it reaches the deploy account: directly with your key if it is authorized (as the CI), else through
// `sudo -iu <deploy account>` from your own account (your sudo password, once). A private temporary folder on the
// machine carries the files (secrets read through redirections: never in a command line), removed at the end.
//   --check       nothing changed: the reverse proxy (Caddy) and its sites (each upstream: a container's name or not),
//                 the machine's PUBLIC_URL, the containers;
//   --init        once: the machine's infra/.env (random secrets, PROD_PUBLIC_URL in https, TRUST_PROXY, the port on
//                 127.0.0.1, the GIF keys) and, after the server started, Slopesque's site in Caddy (infra/caddy.sh);
//   --image local the server's image built here and sent (the default: no publication before a first release);
//   --image X.Y.Z that version's image pulled from GHCR (what the Release workflow deploys).
// `pnpm prod:admin <commande>`: an admin command in the server's container (see ADMIN.md).
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readEnv, ROOT } from './env.mjs';

const { env } = readEnv();
const get = k => (process.env[k] || env[k] || '').replace(/\s+#.*$/, '').trim();
const host = get('DEPLOY_SSH_HOST'), user = get('DEPLOY_USER'), dir = get('DEPLOY_DIR') || 'slopesque';
const caddyDir = get('DEPLOY_CADDY_DIR') || '~/projects/caddy-reverse-proxy/caddyfiles';
if (!host || !user) { console.error('Il manque DEPLOY_SSH_HOST (ton alias SSH) ou DEPLOY_USER (le compte de déploiement) dans ton .env.'); process.exit(1); }
const fail = msg => { console.error(`\n✖ ${msg}`); process.exit(1); };
const quote = s => `'${String(s).replace(/'/g, `'"'"'`)}'`;
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts }); if (r.status !== 0) fail(`échec : ${cmd} ${args.join(' ')}`); return r; };

const dry = process.argv.includes('--dry-run');   // what would run on the machine, printed; nothing sent, nothing built
// ---- how to reach the deploy account: directly (its key), or through sudo from my own account
const direct = dry ? false : spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-l', user, host, 'true'], { stdio: 'ignore' }).status === 0;
const login = direct ? ['-l', user, host] : [host];
if (!dry && !direct && spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'true'], { stdio: 'ignore' }).status !== 0) fail('connexion SSH impossible (DEPLOY_SSH_HOST, ~/.ssh/config)');
if (!dry && !direct && !process.stdin.isTTY) fail(`passage par « sudo -iu ${user} » : lance la commande dans un terminal (ton mot de passe sudo est demandé une fois)`);
console.log(direct ? `Connexion directe en ${user}.` : `Connexion avec ton compte, puis « sudo -iu ${user} » (ton mot de passe sudo, une fois).`);

// ---- pnpm prod:admin
if (process.argv[2] === 'admin') {
  const args = process.argv.slice(3).map(quote).join(' ');
  if (!args) fail('Usage : pnpm prod:admin <commande> [options] (pnpm prod:admin help pour la liste)');
  const inner = `cd ~/${dir}/infra && docker compose -f docker-compose.prod.yml $(grep -qE '^PROXY_NETWORK=.+' .env && echo -f docker-compose.proxy.yml) --env-file .env exec -T server admin ${args}`;
  run('ssh', ['-t', ...login, direct ? inner : `sudo -iu ${user} sh -c ${quote(inner)}`]);
  process.exit(0);
}

const argv = process.argv.slice(2), flag = n => argv.includes(`--${n}`);
const check = flag('check'), init = flag('init');
const image = argv.includes('--image') ? argv[argv.indexOf('--image') + 1] : 'local';
if (!check && image !== 'local' && !/^v?\d+\.\d+\.\d+$/.test(image)) fail(`--image ${image} : local ou X.Y.Z`);

// ---- the bundle, prepared here
const bundle = mkdtempSync(join(tmpdir(), 'slopesque-deploy-'));
const put = (name, text, mode = 0o600) => writeFileSync(join(bundle, name), text, { mode });
for (const f of ['docker-compose.prod.yml', 'docker-compose.proxy.yml', 'deploy.sh', 'caddy.sh']) put(f, readFileSync(join(ROOT, 'infra', f), 'utf8'));
let tag = '';
if (!check) {
  if (init) {
    const url = get('PROD_PUBLIC_URL');
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) fail('PROD_PUBLIC_URL (https://ton-domaine, sans chemin) manque dans ton .env');
    const secret = n => randomBytes(n).toString('base64url'), chrome = readFileSync(join(ROOT, 'apps/extension/extension-id.txt'), 'utf8').trim();
    put('machine.env', `# Slopesque on this machine (written once by \`pnpm deploy:prod --init\`; never in the repository). No backup.
PUBLIC_PORT=23180
PUBLIC_BIND=127.0.0.1
PUBLIC_URL=${url}
ALLOW_INSECURE=false
ALLOWED_ORIGINS=chrome-extension://${chrome},moz-extension://*
TRUST_PROXY=true
CODE_HMAC_SECRET=${secret(48)}
POSTGRES_PASSWORD=${secret(24)}
RUSTFS_SECRET_KEY=${secret(24)}
STORAGE_QUOTA_GB=50
KLIPY_API_KEY=${get('KLIPY_API_KEY')}
GIPHY_API_KEY=${get('GIPHY_API_KEY')}
KLIPY_API_KEY_WITH_AD=${get('KLIPY_API_KEY_WITH_AD')}
`);
    put('site.caddyfile', readFileSync(join(ROOT, 'infra/Caddyfile.template'), 'utf8').replaceAll('{{DOMAIN}}', new URL(url).host));
  }
  if (image === 'local' && dry) tag = 'slopesque-server:local-<commit>';
  else if (image === 'local') {
    const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
    tag = `slopesque-server:local-${sha}`;
    console.log(`→ image du serveur construite ici : ${tag}`);
    run('docker', ['build', '-q', '-t', tag, '-f', 'apps/server/Dockerfile', '.'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
    run('sh', ['-c', `docker save ${tag} | gzip -1 > ${quote(join(bundle, 'image.tar.gz'))}`]);
  } else tag = `ghcr.io/recovizzi/slopesque-server:${image.replace(/^v/, '')}`;
}

// ---- what runs there: the deploy account's commands, the files read through redirections
const remoteDir = `/tmp/slopesque-deploy-${randomBytes(4).toString('hex')}`;
const infra = `~/${dir}/infra`;
const lines = [
  '#!/bin/sh', 'set -eu', `D=${remoteDir}`, 'trap \'rm -rf "$D"\' EXIT',
  ...(direct ? ['as_() { sh -c "$1"; }'] : ['sudo -v', `as_() { sudo -iu ${user} sh -c "$1"; }`]),
  `as_ 'docker info --format "docker {{.ServerVersion}}" > /dev/null'`,
  `as_ 'mkdir -p ${infra}'`,
  `for f in docker-compose.prod.yml docker-compose.proxy.yml deploy.sh caddy.sh; do as_ "cat > ${infra}/$f" < "$D/$f"; done`,
];
if (check) lines.push(
  `as_ 'sh ${infra}/caddy.sh check ${caddyDir}'`,
  `as_ 'echo "PUBLIC_URL de la machine : $(grep -E "^PUBLIC_URL=" ${infra}/.env 2>/dev/null | cut -d= -f2- || echo "(pas encore de infra/.env)")"; echo "conteneurs :"; docker ps --format "  {{.Names}}  ({{.Image}})"'`);
else {
  if (init) lines.push(
    `as_ 'cd ${infra} && if [ -f .env ]; then cat > /dev/null; echo "infra/.env déjà là : gardé tel quel"; else umask 077 && cat > .env && echo "infra/.env écrit (secrets tirés au hasard)"; fi' < "$D/machine.env"`,
    `as_ 'sh ${infra}/caddy.sh network ${caddyDir} ${infra}/.env'`);
  if (image === 'local') lines.push('echo "→ chargement de l\'image sur la machine"', `as_ 'gunzip | docker load > /dev/null' < "$D/image.tar.gz"`);
  lines.push(`as_ 'sh ${infra}/deploy.sh ${tag}${image === 'local' ? '' : ' pull'}'`);
  if (init) lines.push(`as_ 'sh ${infra}/caddy.sh install ${caddyDir} ${infra}/.env' < "$D/site.caddyfile"`);
}
put('run.sh', `${lines.join('\n')}\n`, 0o700);

if (dry) { console.log(`\n--- run.sh (sur la machine)\n${readFileSync(join(bundle, 'run.sh'), 'utf8')}--- fichiers : ${spawnSync('ls', [bundle], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).join(', ')}`); rmSync(bundle, { recursive: true, force: true }); process.exit(0); }
// ---- sent, run in one session, removed
try {
  console.log('→ envoi sur la machine');
  run('ssh', ['-o', 'BatchMode=yes', ...login, `umask 077 && mkdir ${remoteDir}`]);
  run('scp', ['-q', '-o', 'BatchMode=yes', ...(direct ? ['-o', `User=${user}`] : []), ...['run.sh', 'docker-compose.prod.yml', 'docker-compose.proxy.yml', 'deploy.sh', 'caddy.sh', ...(init && !check ? ['machine.env', 'site.caddyfile'] : []), ...(image === 'local' && !check ? ['image.tar.gz'] : [])].map(f => join(bundle, f)), `${host}:${remoteDir}/`]);
  run('ssh', ['-t', ...login, `sh ${remoteDir}/run.sh`]);
} finally { rmSync(bundle, { recursive: true, force: true }); }
console.log(check ? '\n✓ Vérification faite (rien n\'a changé).' : `\n✓ Déployé : ${tag}. Vérifie ${get('PROD_PUBLIC_URL') || 'l\'adresse publique'}/api/health.`);

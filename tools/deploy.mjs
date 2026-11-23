// `pnpm deploy:prod [--init] [--image local|X.Y.Z]` (`pnpm deploy` is pnpm's own command): the production stack on the
// project's machine (openspec: repo-and-secrets, Déploiement), run by you, from your machine. The machine is named only
// in your .env (git-ignored) and your ~/.ssh/config: DEPLOY_SSH_HOST (an SSH alias), DEPLOY_USER (the deploy account,
// reached directly with your key — as the CI does), DEPLOY_DIR. Never in the repository.
//   --init        the machine's own infra/.env written once (random secrets, PROD_PUBLIC_URL in https, the GIF keys of
//                 your .env, the extensions' origins), and the reverse proxy's site file (infra/Caddyfile.template →
//                 DEPLOY_CADDY_DIR/slopesque.caddyfile, then DEPLOY_CADDY_RELOAD);
//   --image local the server's image built here and sent over SSH (the default: no publication before a first release);
//   --image X.Y.Z that version's image pulled from GHCR (what the Release workflow deploys).
// `pnpm prod:admin <commande>`: an admin command in the server's container (see ADMIN.md).
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readEnv, ROOT } from './env.mjs';

const { env } = readEnv();
const get = k => (process.env[k] || env[k] || '').replace(/\s+#.*$/, '').trim();
const host = get('DEPLOY_SSH_HOST'), user = get('DEPLOY_USER'), dir = get('DEPLOY_DIR') || 'slopesque';
if (!host || !user) { console.error('Il manque DEPLOY_SSH_HOST (ton alias SSH) ou DEPLOY_USER (le compte de déploiement) dans ton .env.'); process.exit(1); }
const fail = msg => { console.error(`\n✖ ${msg}`); process.exit(1); };
const quote = s => `'${String(s).replace(/'/g, `'"'"'`)}'`;
/** A command on the machine, as the deploy account; `input`: what its standard input reads. */
function remote(cmd, { input, tty = false } = {}) {
  const r = spawnSync('ssh', [...(tty ? ['-t'] : ['-o', 'BatchMode=yes']), '-l', user, host, cmd], { stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'], input });
  if (r.status === 255) fail(`connexion impossible en ${user} : sa clé SSH n'est pas autorisée (MANQUES.md, « Accès au compte de déploiement »)`);
  if (r.status !== 0) fail(`échec sur la machine (code ${r.status})`);
}
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts }); if (r.status !== 0) fail(`échec : ${cmd} ${args.join(' ')}`); };

// ---- pnpm prod:admin
if (process.argv[2] === 'admin') {
  const args = process.argv.slice(3).map(quote).join(' ');
  if (!args) fail('Usage : pnpm prod:admin <commande> [options] (pnpm prod:admin help pour la liste)');
  remote(`cd ~/${dir}/infra && docker compose -f docker-compose.prod.yml --env-file .env exec -T server admin ${args}`, { tty: true });
  process.exit(0);
}

const argv = process.argv.slice(2), flag = n => argv.includes(`--${n}`);
const image = argv.includes('--image') ? argv[argv.indexOf('--image') + 1] : 'local';
console.log(`Déploiement : compte ${user}, dossier ~${user}/${dir}. Aucune sauvegarde n'est faite.`);
// the machine able to run it: Docker answers, /run is not full (docker creates its files there)
remote('docker info --format "docker {{.ServerVersion}}" && df -P /run | tail -1 | awk \'{ if ($5+0 >= 98) { print "/run est plein (" $5 ") : à libérer avant tout (MANQUES.md)"; exit 1 } }\'');

// ---- --init: the machine's infra/.env (once) and the reverse proxy's site
if (flag('init')) {
  const url = get('PROD_PUBLIC_URL');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) fail('PROD_PUBLIC_URL (https://ton-domaine, sans chemin) manque dans ton .env');
  const secret = n => randomBytes(n).toString('base64url');
  const chrome = readFileSync(join(ROOT, 'apps/extension/extension-id.txt'), 'utf8').trim();
  const machineEnv = `# Slopesque on this machine (written once by \`pnpm deploy:prod --init\`; never in the repository). No backup.
PUBLIC_PORT=23180
PUBLIC_BIND=${get('DEPLOY_BIND') || '127.0.0.1'}
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
`;
  remote(`mkdir -p ~/${dir}/infra && cd ~/${dir}/infra && if [ -f .env ]; then cat > /dev/null; echo "infra/.env déjà là : gardé tel quel"; else umask 077 && cat > .env && echo "infra/.env écrit (secrets tirés au hasard)"; fi`, { input: machineEnv });
  const caddyDir = get('DEPLOY_CADDY_DIR');
  if (caddyDir) {
    const site = readFileSync(join(ROOT, 'infra/Caddyfile.template'), 'utf8').replaceAll('{{DOMAIN}}', new URL(url).host).replaceAll('{{UPSTREAM}}', get('DEPLOY_CADDY_UPSTREAM') || '127.0.0.1:23180');
    remote(`cat > ${caddyDir}/slopesque.caddyfile && echo "site Caddy écrit : ${caddyDir}/slopesque.caddyfile"`, { input: site });
    const reload = get('DEPLOY_CADDY_RELOAD');
    if (reload) remote(reload); else console.log('  (DEPLOY_CADDY_RELOAD vide : recharge Caddy toi-même)');
  } else console.log('  (DEPLOY_CADDY_DIR vide : site Caddy non écrit)');
}

// ---- the server's image: built here and sent, or a version from GHCR
let tag;
if (image === 'local') {
  const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  tag = `slopesque-server:local-${sha}`;
  console.log(`→ image construite ici : ${tag}`);
  run('docker', ['build', '-t', tag, '-f', 'apps/server/Dockerfile', '.'], { cwd: ROOT });
  console.log('→ envoyée sur la machine (docker save | ssh docker load)');
  run('sh', ['-c', `docker save ${tag} | gzip -1 | ssh -o BatchMode=yes -l ${quote(user)} ${quote(host)} 'gunzip | docker load'`]);
} else if (/^v?\d+\.\d+\.\d+$/.test(image)) tag = `ghcr.io/recovizzi/slopesque-server:${image.replace(/^v/, '')}`;
else fail(`--image ${image} : local ou X.Y.Z`);

// ---- the stack: the compose file copied, the image started, the health checked
remote(`mkdir -p ~/${dir}/infra && cat > ~/${dir}/infra/docker-compose.prod.yml`, { input: readFileSync(join(ROOT, 'infra/docker-compose.prod.yml'), 'utf8') });
remote([
  'set -e', `cd ~/${dir}/infra`, 'test -f .env || { echo "Il manque infra/.env sur la machine : pnpm deploy:prod --init"; exit 1; }', `export SERVER_IMAGE=${quote(tag)}`,
  ...(image === 'local' ? [] : ['docker compose -f docker-compose.prod.yml --env-file .env pull server']),
  'docker compose -f docker-compose.prod.yml --env-file .env up -d --wait --no-build',
  'port=$(grep -E "^PUBLIC_PORT=" .env | cut -d= -f2)', 'curl -fsS http://127.0.0.1:$port/api/health && echo',
].join('\n'));
console.log(`\n✓ Déployé : ${tag}. Vérifie ${get('PROD_PUBLIC_URL') || 'l\'adresse publique'}/api/health depuis ton navigateur.`);

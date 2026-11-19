// `pnpm stack:up` / `stack:down` / `stack:logs`: the production stack (infra/docker-compose.prod.yml) on this machine's
// Docker, built from the sources. infra/.env (git-ignored) is written once with random secrets if missing.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './env.mjs';

const envFile = join(ROOT, 'infra/.env'), cmd = process.argv[2] ?? 'up';
if (!existsSync(envFile)) {
  const secret = n => randomBytes(n).toString('base64url');
  writeFileSync(envFile, `# Production stack on this machine (git-ignored). Written by \`pnpm stack:up\` with random secrets.
PUBLIC_PORT=23180
PUBLIC_URL=http://localhost:23180
# without a domain (http to a public address): ALLOW_INSECURE=true, and the panel says « Connexion non chiffrée »
ALLOW_INSECURE=false
ALLOWED_ORIGINS=chrome-extension://flplhoclphjglaebgoabfijfbffbcmbj,moz-extension://*
CODE_HMAC_SECRET=${secret(48)}
POSTGRES_PASSWORD=${secret(24)}
RUSTFS_SECRET_KEY=${secret(24)}
STORAGE_QUOTA_GB=50
TRUST_PROXY=false
KLIPY_API_KEY=
GIPHY_API_KEY=
KLIPY_API_KEY_WITH_AD=
`, { mode: 0o600 });
  console.log('infra/.env écrit (secrets tirés au hasard).');
}
const compose = (...a) => spawnSync('docker', ['compose', '-f', join(ROOT, 'infra/docker-compose.prod.yml'), '--env-file', envFile, ...a], { stdio: 'inherit' }).status ?? 1;
if (cmd === 'up') {
  const code = compose('up', '-d', '--build', '--wait');
  if (code === 0) console.log('\nSlopesque tourne : http://localhost:23180 (port PUBLIC_PORT de infra/.env).\nDans l\'extension : onglet Extension → Serveur → http://localhost:23180\nAdmin : docker compose -f infra/docker-compose.prod.yml exec server admin rooms:create --name "Mon salon"\nSauvegardes : aucune.');
  process.exit(code);
}
process.exit(cmd === 'down' ? compose('down') : cmd === 'logs' ? compose('logs', '-f', 'server') : compose(...process.argv.slice(2)));

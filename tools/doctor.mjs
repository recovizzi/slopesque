// `pnpm doctor`: what works, what runs degraded, what to do — service by service, key by key (repo-and-secrets).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { ROOT, readEnv } from './env.mjs';

const { env, file } = readEnv();
const rows = [];
const ok = (what, note = '') => rows.push(['✓', what, note]);
const warn = (what, note) => rows.push(['⚠', what, note]);
const bad = (what, note) => rows.push(['✗', what, note]);
const port = url => new Promise(res => {
  try {
    const u = new URL(url), s = net.connect({ host: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80), timeout: 1500 });
    s.on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)).on('timeout', () => { s.destroy(); res(false); });
  } catch { res(false); }
});

file.endsWith('.example') ? warn('Configuration', '.env absent : valeurs de .env.example (développement)') : ok('Configuration', '.env');
spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0 ? ok('Docker') : bad('Docker', 'ne répond pas : lance Docker');
(await port(env.DATABASE_URL.replace(/^postgres(ql)?:/, 'http:'))) ? ok('Postgres', 'joignable') : bad('Postgres', 'injoignable : `pnpm services:up` (indispensable)');
env.REDIS_URL ? ((await port(env.REDIS_URL.replace(/^redis:/, 'http:'))) ? ok('Redis', 'joignable') : warn('Redis', 'injoignable : pas de cache (mode dégradé)')) : warn('Redis', 'non configuré : pas de cache');
env.S3_ENDPOINT ? ((await port(env.S3_ENDPOINT)) ? ok('RustFS', 'joignable') : warn('RustFS', 'injoignable : images indisponibles')) : warn('RustFS', 'non configuré : images indisponibles');

let health = null;
try { health = await (await fetch(`http://localhost:${env.PORT}/api/health`, { signal: AbortSignal.timeout(1500) })).json(); } catch { /* not running */ }
if (health) {
  ok('Serveur', `répond sur le port ${env.PORT} (protocole ${health.protocol})`);
  const u = health.storage;
  if (u) {
    const pct = `${(u.ratio * 100).toFixed(1)} % de ${(u.quotaBytes / 1024 ** 3).toFixed(0)} Go`;
    u.level === 'ok' ? ok('Place', pct) : u.level === 'warn' ? warn('Place', `${pct} : bientôt plein`) : bad('Place', `${pct} : envois d'images refusés`);
  }
} else warn('Serveur', `ne répond pas sur le port ${env.PORT} (lance \`pnpm dev\`)`);

env.KLIPY_API_KEY || env.GIPHY_API_KEY
  ? ok('GIF', [env.KLIPY_API_KEY && 'KLIPY', env.GIPHY_API_KEY && 'GIPHY'].filter(Boolean).join(' + '))
  : warn('GIF', 'aucune clé : la fenêtre GIF le dit (voir MANQUES.md)');
const insecure = !/^https:/.test(env.PUBLIC_URL) && !/\/\/(localhost|127\.)/.test(env.PUBLIC_URL);
insecure ? warn('Chiffrement', `${env.PUBLIC_URL} : connexion non chiffrée`) : ok('Chiffrement', /^https:/.test(env.PUBLIC_URL) ? 'https' : 'local (pas besoin)');
warn('Sauvegardes', 'aucune : une base, un disque ou un salon supprimés ne se récupèrent pas');
env.WEB_EXT_API_KEY && env.WEB_EXT_API_SECRET ? ok('Signature Firefox', 'clés AMO en local') : warn('Signature Firefox', 'clés AMO absentes en local (la CI a les siennes, voir MANQUES.md)');
existsSync(env.CHROME_CRX_KEY_FILE || join(ROOT, 'slopesque-crx.pem')) ? ok('Clé CRX', 'présente en local') : warn('Clé CRX', 'absente en local : pas de .crx signé hors CI');

const w = Math.max(...rows.map(r => r[1].length));
console.log(rows.map(([s, what, note]) => `${s} ${what.padEnd(w)}  ${note}`).join('\n'));
if (existsSync(join(ROOT, 'MANQUES.md'))) console.log('\nActions en attente : MANQUES.md');
process.exit(rows.some(r => r[0] === '✗') ? 1 : 0);

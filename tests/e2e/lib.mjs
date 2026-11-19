// End-to-end helpers: the built server (dist/) on its own port with the development services, the admin console,
// and browsers loaded with the built extension, each with its own profile (its own device storage, its own code).
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const OUT = path.join(ROOT, 'tests/e2e/shots');
// E2E_STACK=1: against the production stack running on this Docker (`pnpm stack:up`, port 8080) instead of dist/;
// infra/.env then needs CODE_ATTEMPTS_PER_MINUTE=1000 (the test makes many accounts from one address) and
// ROBOT_DELAY_MS=60 (the card robots play fast enough for the test's waits)
export const STACK = process.env.E2E_STACK === '1';
export const PORT = STACK ? 8080 : 3198, SERVER = `http://localhost:${PORT}`;
const compose = ['compose', '-f', path.resolve(import.meta.dirname, '../../infra/docker-compose.prod.yml'), '--env-file', path.resolve(import.meta.dirname, '../../infra/.env')];
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: SERVER, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', ROBOT_DELAY_MS: '60' };
const serverDir = path.join(ROOT, 'apps/server');

let failed = 0;
export const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };
export const failures = () => failed;
export const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 100)); } return false; };

let server = null;
process.on('exit', () => server?.kill());
process.on('uncaughtException', e => { console.error(e); server?.kill(); process.exit(1); });
export async function startServer() {
  if (STACK) {
    execFileSync('docker', [...compose, 'start', 'server'], { stdio: 'ignore' });
    if (!(await until(async () => (await fetch(`${SERVER}/api/health`)).ok, 60000))) throw new Error('the stack\'s server did not start');
    return;
  }
  server = spawn(process.execPath, ['dist/main.js'], { cwd: serverDir, env, stdio: ['ignore', 'inherit', 'inherit'] });
  if (!(await until(async () => (await fetch(`${SERVER}/api/health`)).ok, 15000))) throw new Error('the server did not start');
}
export async function stopServer() { if (STACK) { execFileSync('docker', [...compose, 'stop', 'server'], { stdio: 'ignore' }); return; } if (!server) return; const s = server; server = null; s.kill(); await new Promise(r => s.once('exit', r)); }
export const admin = (...args) => (STACK ? execFileSync('docker', [...compose, 'exec', '-T', 'server', 'admin', ...args], { encoding: 'utf8' })
  : execFileSync(process.execPath, ['dist/admin.js', ...args], { cwd: serverDir, env, encoding: 'utf8' }));

// Colour emoji in the screenshots: headless Chromium on Linux may have no emoji font. Noto Color Emoji, downloaded once
// into tests/e2e/.cache/ (git-ignored), is given to the test browser only, through fontconfig.
async function emojiFont() {
  if (process.platform !== 'linux') return undefined;
  const dir = path.join(ROOT, 'tests/e2e/.cache/fonts'), file = path.join(dir, 'NotoColorEmoji.ttf');
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) {
    try {
      const r = await fetch('https://raw.githubusercontent.com/googlefonts/noto-emoji/v2.047/fonts/NotoColorEmoji.ttf');
      if (!r.ok) throw new Error(String(r.status));
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    } catch (e) { console.warn(`emoji font not downloaded (${e.message})`); return undefined; }
  }
  const conf = path.join(dir, 'fonts.conf');
  fs.writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include><dir>${dir}</dir><cachedir>${path.join(dir, 'cache')}</cachedir></fontconfig>`);
  return { ...process.env, FONTCONFIG_FILE: conf };
}
const fontEnv = await emojiFont();

const PAGE = `<!doctype html><html lang="fr"><body style="margin:0;font:16px system-ui;background:#e9eef3">
  <div style="padding:40px;max-width:620px;color:#556"><h1>Une page quelconque</h1>${'<p>Lorem ipsum dolor sit amet. '.repeat(12)}</p></div></body></html>`;

export const WEB = { ok: 'https://lowtide.test', other: 'https://autre.test', down: 'https://down.test' };

/** A browser with the extension (a copy allowed on the test page), as a new player. */
export async function player(scheme = 'light', { presetServer = true } = {}) {
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'slp-ext-'));
  fs.cpSync(path.join(ROOT, 'apps/extension/dist/extension'), ext, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify({ ...mf, host_permissions: ['https://example.org/*', ...Object.values(WEB).map(o => `${o}/*`)] }));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'slp-profile-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    env: fontEnv, headless: false, colorScheme: scheme, viewport: { width: 1280, height: 760 }, locale: 'fr-FR',
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  await ctx.route('https://example.org/**', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
  // the integration's test sites (served here: the tests don't depend on a tunnel): Low Tide, another game, a site down
  const game = (title, bg) => `<!doctype html><html><head><title>${title}</title><link rel="manifest" href="index.manifest.json"></head>
    <body style="margin:0;height:100vh;display:grid;place-items:center;background:${bg};color:#fff;font:700 28px system-ui">${title} (page de test)</body></html>`;
  for (const [origin, title, bg] of [[WEB.ok, 'Low Tide', '#2a6f97'], [WEB.other, 'Autre jeu', '#7a2e2e']]) {
    await ctx.route(`${origin}/**`, r => (r.request().url().endsWith('manifest.json')
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: title }) })
      : r.fulfill({ contentType: 'text/html', body: game(title, bg) })));
  }
  await ctx.route(`${WEB.down}/**`, r => r.abort());
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker');
  for (let k = 0; k < 40 && !(await sw.evaluate(() => !!globalThis.chrome?.storage?.local)); k++) await new Promise(r => setTimeout(r, 100));
  // the server of this test, before the app reads its settings
  if (presetServer) await sw.evaluate(s => chrome.storage.local.set({ 'slp-device': { server: s } }), SERVER);
  return {
    ctx, sw,
    async open(size = { w: 780, h: 620 }) {
      await sw.evaluate(s => chrome.storage.local.set({ panelSize: s }), size);
      const page = await ctx.newPage();
      await page.goto('https://example.org/');
      await sw.evaluate(async () => {
        const [t] = await chrome.tabs.query({ active: true, url: 'https://example.org/*' });
        await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['panel.js'] });
      });
      let frame = null;
      for (let k = 0; k < 40 && !frame; k++) { await page.waitForTimeout(250); frame = page.frames().find(f => f.url().includes('app/index.html?embed')); }
      if (!frame) throw new Error('the panel did not open');
      await frame.waitForSelector('#app header');
      await page.waitForTimeout(800);   // headless Chromium drops clicks sent to a just-created extension frame
      return { page, frame };
    },
    async close() { await ctx.close(); fs.rmSync(profile, { recursive: true, force: true }); fs.rmSync(ext, { recursive: true, force: true }); },
  };
}

export function prepareShots() { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
export const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

// Builds the extension:
//   dist/extension/                    MV3 extension (Chrome, Edge, Brave)
//   dist/extension-firefox/            the same with Firefox's background key (Chromium rejects `background.scripts`)
//   dist/slopesque-extension.zip  the same, zipped (release asset, Chrome "Load unpacked")
// The game itself is the web app (apps/web), built first (`pnpm build` at the root) and copied to app/.
// Two variants (openspec: plan-slopesque-v1 decision 23), installed side by side:
//   SLOPESQUE_RELEASE=1 (the Release workflow): « Slopesque », its key (the fixed Chrome id), its gecko id, its icons;
//   else (`pnpm build`): « Slopesque (dev) », no key (another Chrome id, kept while the folder doesn't move), its own
//   gecko id, the orange « DEV » icons — its own storage, account and server (localhost:23100 by default).
import fs from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { zipSync } from 'fflate';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const web = path.resolve(root, '../web/dist');
if (!fs.existsSync(path.join(web, 'index.html'))) throw new Error('apps/web/dist is missing: run `pnpm build` at the root');
const underscore = fs.readdirSync(web, { recursive: true }).find(f => path.basename(String(f)).startsWith('_'));
if (underscore) throw new Error(`Chrome refuses files starting with « _ »: ${underscore}`);
const release = process.env.SLOPESQUE_RELEASE === '1';
const name = release ? 'Slopesque' : 'Slopesque (dev)', icons = release ? 'icons' : 'icons/dev';
const dist = path.join(root, 'dist');
const ext = path.join(dist, 'extension');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(ext, 'icons'), { recursive: true });

const manifest = {
  manifest_version: 3,
  name,
  version: pkg.version,
  description: pkg.description,
  icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  // no default_popup: the icon injects the floating panel (background.js → panel.js), the popup only as a fallback
  action: { default_title: name, default_icon: { 16: 'icons/16.png', 32: 'icons/32.png' } },
  background: { service_worker: 'background.js' },
  // explicit: Firefox's MV3 default adds upgrade-insecure-requests, which would block a server without TLS (decision 15)
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
  permissions: ['storage', 'activeTab', 'scripting'],
  // the shortcut (changed in the browser's shortcuts page; Firefox: in the Extension tab too)
  commands: { 'toggle-panel': { suggested_key: { default: 'Alt+Shift+S' }, description: `Ouvrir ou fermer ${name}` } },
  // integrations: reading a site's page to check it declares the expected app (asked to the host, site by site)
  // asked only when « Rester ouvert sur toutes les pages » is turned on (panel-persistence), and for integrations
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  web_accessible_resources: [{ resources: ['app/*'], matches: ['<all_urls>'] }],   // framed by the panel
  browser_specific_settings: { gecko: { id: release ? 'slopesque@recovizzi' : 'slopesque-dev@recovizzi', strict_min_version: '142.0', data_collection_permissions: { required: ['none'] } } },
};
// Chrome: the public key fixes the extension's id (the same unpacked or from the .crx; see extension-id.txt). The private
// key never enters the repository (CHROME_CRX_KEY secret, slopesque-crx.pem kept locally). Firefox has its gecko id.
const publicKey = fs.readFileSync(path.join(root, 'public-key.txt'), 'utf8').trim();
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(release ? { ...manifest, key: publicKey } : manifest, null, 2));
for (const entry of ['background.js', 'panel.js', 'panel-auto.js']) buildSync({
  entryPoints: [path.join(root, 'src', entry)], outfile: path.join(ext, entry),
  bundle: true, format: 'iife', target: ['chrome120', 'firefox128'], legalComments: 'inline',
});
fs.cpSync(web, path.join(ext, 'app'), { recursive: true });
for (const s of [16, 32, 48, 128]) fs.copyFileSync(path.join(root, icons, `${s}.png`), path.join(ext, 'icons', `${s}.png`));

const ff = path.join(dist, 'extension-firefox');
fs.cpSync(ext, ff, { recursive: true });
fs.writeFileSync(path.join(ff, 'manifest.json'), JSON.stringify({ ...manifest, background: { scripts: ['background.js'] } }, null, 2));

// zipped in JS: no `zip` binary needed (missing on stock Ubuntu/WSL and Windows)
const files = {};
for (const f of fs.readdirSync(ext, { recursive: true })) {
  const p = path.join(ext, f);
  if (fs.statSync(p).isFile()) files[f.split(path.sep).join('/')] = fs.readFileSync(p);
}
fs.writeFileSync(path.join(dist, 'slopesque-extension.zip'), zipSync(files, { level: 9 }));
console.log(`dist/extension/  ${name} v${manifest.version}${release ? '' : ' (développement : SLOPESQUE_RELEASE=1 pour la version publiée)'}`);
console.log('dist/extension-firefox/');
console.log('dist/slopesque-extension.zip');

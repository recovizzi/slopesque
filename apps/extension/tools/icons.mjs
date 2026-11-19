// Renders icons/logo.svg to the PNG sizes the manifest needs (icons/*.png). PW_CHROMIUM=/path/to/chrome overrides
// Playwright's bundled Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const svg = fs.readFileSync(path.join(root, 'icons/logo.svg'), 'utf8');
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const p = await b.newPage();
for (const s of [16, 32, 48, 128]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
  await p.screenshot({ path: path.join(root, `icons/${s}.png`), omitBackground: true });
}
await b.close();
console.log('icons/{16,32,48,128}.png');

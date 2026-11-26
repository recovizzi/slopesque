// Renders icons/logo.svg (and icons/logo-dev.svg: the development extension's) to the PNG sizes the manifest needs
// (icons/*.png, icons/dev/*.png). PW_CHROMIUM=/path/to/chrome overrides
// Playwright's bundled Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const p = await b.newPage();
for (const [file, out] of [['logo.svg', 'icons'], ['logo-dev.svg', 'icons/dev']]) {
  const svg = fs.readFileSync(path.join(root, 'icons', file), 'utf8');
  fs.mkdirSync(path.join(root, out), { recursive: true });
  for (const s of [16, 32, 48, 128]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
    await p.screenshot({ path: path.join(root, out, `${s}.png`), omitBackground: true });
  }
  console.log(`${out}/{16,32,48,128}.png`);
}
await b.close();

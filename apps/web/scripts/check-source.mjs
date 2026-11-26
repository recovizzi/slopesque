// Source checks of the web app (run by `pnpm lint`, so by `pnpm check`), openspec refactor-architecture:
//   1. no HTML built as text: innerHTML, insertAdjacentHTML, dangerouslySetInnerHTML (React renders the views);
//   2. files of a sensible size: at most 300 lines, unless a `size-exception: <why>` comment opens the file;
//   3. no colour literal in a stylesheet outside a custom property: theme colours are tokens (design/tokens.css),
//      a feature's own colours (felt, chips, suits) are named custom properties at the top of its file.
// Provisional exceptions: scripts/source-allowlist.mjs (each with its owner; the list only shrinks).
import fs from 'node:fs';
import path from 'node:path';
import { HTML, SIZE } from './source-allowlist.mjs';

const SRC = path.resolve(import.meta.dirname, '../src');
const MAX_LINES = 300;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|css)$/.test(e.name)) files.push(path.relative(SRC, p).split(path.sep).join('/'));
  }
})(SRC);

const errors = [];
const seen = { html: new Set(), size: new Set() };
const HTML_SINK = /\b(innerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)\b/g;
// a colour written out: #rgb…#rrggbbaa, rgb()/hsl()…, or a named colour as a value
const COLOR =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w-])(?:white|black|red|green|blue|yellow|orange|gray|grey|purple|pink|gold)(?![\w-])/i;

for (const f of files) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  const lines = text.split('\n');
  if (!f.endsWith('.css')) {
    const n = (text.match(HTML_SINK) ?? []).length;
    if (n) {
      seen.html.add(f);
      const allowed = HTML[f]?.[0] ?? 0;
      if (n > allowed)
        errors.push(
          `${f}: HTML built as text (${n} × innerHTML / insertAdjacentHTML / dangerouslySetInnerHTML${allowed ? `, ${allowed} allowed` : ''}): render it with React`,
        );
    }
  }
  const count = lines.at(-1) === '' ? lines.length - 1 : lines.length;
  if (count > MAX_LINES && !lines.slice(0, 5).some(l => l.includes('size-exception:'))) {
    seen.size.add(f);
    if (!SIZE[f])
      errors.push(
        `${f}: ${count} lines (max ${MAX_LINES}): split it by responsibility, or justify it in a \`size-exception:\` comment at its top`,
      );
  }
  if (f.endsWith('.css') && f !== 'design/tokens.css') {
    const bare = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')); // comments out, offsets kept
    for (const m of bare.matchAll(/(?<=^|[;{}\s])(-?[a-z][\w-]*)\s*:\s*([^;{}]+)/g)) {
      const value = m[2].replace(/\b(?:rgba?|hsla?)\([^()]*var\([^()]*\)[^()]*\)/g, ''); // computed from a variable: not a literal
      if (m[1].startsWith('--') || !COLOR.test(value)) continue;
      const line = bare.slice(0, m.index).split('\n').length;
      errors.push(
        `${f}:${line}: colour literal in « ${m[1]}: ${m[2].trim().replace(/\s+/g, ' ')} »: use a token (design/tokens.css) or a named custom property of the feature`,
      );
    }
  }
}
for (const f of Object.keys(HTML))
  if (!seen.html.has(f))
    errors.push(
      `scripts/source-allowlist.mjs: ${f} has no HTML built as text any more (or is gone): remove it from HTML`,
    );
for (const f of Object.keys(SIZE))
  if (!seen.size.has(f))
    errors.push(
      `scripts/source-allowlist.mjs: ${f} is no longer over ${MAX_LINES} lines (or is gone): remove it from SIZE`,
    );
for (const [f, [n]] of Object.entries(HTML)) {
  const now = seen.html.has(f) ? (fs.readFileSync(path.join(SRC, f), 'utf8').match(HTML_SINK) ?? []).length : 0;
  if (now && now < n)
    errors.push(`scripts/source-allowlist.mjs: ${f} has ${now} occurrence(s) left: lower its count to ${now}`);
}

if (errors.length) {
  console.error(errors.map(e => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ source checks: ${files.length} files (HTML as text, size, colours)`);

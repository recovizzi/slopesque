// Generates src/emoji-fr.json: the picker's French data (emoji-picker-element-data fr/emojibase: names, keywords,
// categories) with the `:code:` of every emoji added (`shortcodes`), so the picker searches and shows them, and the
// chat turns `:rire:` into 😂. Sources, a code keeps its first emoji: short French aliases (below), English codes (emojibase: :yes:, :joy:, :+1:…),
// GitHub's, then the French CLDR names (:visage_riant_aux_larmes:), which cover every emoji. The emoji are written
// as in the picker's data (emoji-picker-element-data fr), so a code and a click in the picker give the same reaction.
// Run: pnpm --filter @scd/web gen:shortcodes (after updating emoji-picker-element-data).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const data = name => require(`emoji-picker-element-data/${name}/data.json`);
const base = data('fr/emojibase');
const canon = new Map(base.map(e => [e.emoji.replace(/️/g, ''), e.emoji]));
const norm = e => canon.get(e.replace(/️/g, '')) ?? e;

const FR = {
  rire: '😂', mdr: '🤣', lol: '😆', sourire: '😀', content: '😊', heureux: '😁', clin: '😉', clin_doeil: '😉', coeur: '❤️',
  amoureux: '😍', bisou: '😘', cool: '😎', pouce: '👍', pouce_bas: '👎', ok: '👌', bravo: '👏', applaudir: '👏', merci: '🙏',
  prier: '🙏', triste: '😢', larme: '😢', pleure: '😭', colere: '😡', enerve: '😠', choc: '😱', peur: '😨', surpris: '😮',
  gene: '😅', rougir: '😳', pense: '🤔', reflechit: '🤔', dodo: '😴', malade: '🤒', vomir: '🤮', fete: '🎉', cadeau: '🎁',
  gateau: '🎂', feu: '🔥', cent: '💯', etoile: '⭐', soleil: '☀️', pluie: '🌧️', neige: '❄️', eclair: '⚡', cafe: '☕',
  biere: '🍺', vin: '🍷', pizza: '🍕', frites: '🍟', fusee: '🚀', muscle: '💪', salut: '👋', coucou: '👋', yeux: '👀',
  ange: '😇', diable: '😈', fantome: '👻', caca: '💩', mort: '💀', robot: '🤖', chat: '🐱', chien: '🐶', oui: '✅',
  non: '❌', croix: '❌', attention: '⚠️', question: '❓', idee: '💡', argent: '💰', trophee: '🏆', medaille: '🥇',
  victoire: '✌️', doigts_croises: '🤞', facepalm: '🤦', bof: '😒', yeux_au_ciel: '🙄', sueur: '😓', calin: '🤗', zen: '😌',
  fou: '🤪', langue: '😛', chut: '🤫', nul: '👎', top: '🔝', bebe: '👶', clown: '🤡', licorne: '🦄', arc_en_ciel: '🌈',
};

const out = [], seen = new Set();
const add = (code, emoji) => { if (!seen.has(code)) { seen.add(code); out.push([code, norm(emoji)]); } };
for (const [c, e] of Object.entries(FR)) add(c, e);
for (const src of ['en/emojibase', 'en/github', 'fr/cldr']) for (const e of data(src)) for (const c of e.shortcodes ?? []) add(c, e.emoji);

// an emoji whose codes were all taken first (:dodo: is 😴 in French, 🦤 elsewhere) gets its own: :dodo_2:
const covered = new Set(out.map(([, e]) => e));
for (const e of data('fr/cldr')) {
  if (covered.has(norm(e.emoji)) || !e.shortcodes?.length) continue;
  let i = 2;
  while (seen.has(`${e.shortcodes[0]}_${i}`)) i++;
  add(`${e.shortcodes[0]}_${i}`, e.emoji);
}
const missing = base.filter(e => !out.some(([, x]) => x === e.emoji)).length;
const codes = new Map();
for (const [c, e] of out) codes.set(e, [...(codes.get(e) ?? []), c]);
const file = path.join(import.meta.dirname, '..', 'src', 'emoji-fr.json');
fs.writeFileSync(file, JSON.stringify(base.map(e => ({ ...e, shortcodes: codes.get(e.emoji) ?? [] }))));
console.log(`${out.length} codes, ${base.length - missing}/${base.length} emoji covered → ${path.relative(process.cwd(), file)}`);

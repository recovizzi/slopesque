// The chat's commands with their arguments (openspec: chat-activity, Commandes) : `/activity cartes tarot`,
// `/credit-social Léa +100`; what can follow what is typed, shown above the chat as for the emoji codes.
import type { ActivityChoice, MemberView } from '@slopesque/shared';
import type { Suggestion } from './emoji';

/** Lower case, no accents, spaces for - and _: « Trou-du-Cul » → « trou du cul ». */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]+/g, ' ').trim();

interface Format { code: string; label: string; names: string[]; choice: ActivityChoice }
interface Act { code: string; label: string; kind: string; names: string[]; choice?: ActivityChoice; formats?: Format[] }
export const ACTS: Act[] = [
  { code: 'chat', label: 'Chat', kind: 'chat', names: ['chat'], choice: { activity: 'chat' } },
  { code: 'demi-disque', label: 'Demi-disque', kind: 'disk', names: ['demi disque', 'disque', 'disk'], formats: [
    { code: 'rayon-libre', label: 'Rayon libre', names: ['rayon libre', 'rayon', 'libre'], choice: { activity: 'disk', mode: 'ray' } },
    { code: 'amphitheatre', label: 'Amphithéâtre', names: ['amphitheatre', 'amphi'], choice: { activity: 'disk', mode: 'amphi' } }] },
  { code: 'sondage', label: 'Sondage', kind: 'poll', names: ['sondage', 'poll'], choice: { activity: 'poll' } },
  { code: 'roulette', label: 'Roulette', kind: 'wheel', names: ['roulette', 'roue', 'wheel'], choice: { activity: 'wheel' } },
  { code: 'cartes', label: 'Cartes', kind: 'cards', names: ['cartes', 'carte', 'cards'], formats: [
    { code: 'trou-du-cul', label: 'Trou du cul', names: ['trou du cul', 'tdc', 'president'], choice: { activity: 'cards', cardGame: 'tdc' } },
    { code: 'tarot', label: 'Tarot', names: ['tarot'], choice: { activity: 'cards', cardGame: 'tarot' } },
    { code: 'holdem', label: 'Texas Hold\'em', names: ['texas holdem', 'texasholdem', 'texas hold\'em', 'texas hold em', 'hold\'em', 'holdem', 'texas', 'poker'], choice: { activity: 'cards', cardGame: 'holdem' } }] },
  { code: 'low-tide', label: 'Low Tide', kind: 'web', names: ['low tide', 'lowtide', 'jeux web', 'web'], choice: { activity: 'lowtide' } },
];

const starts = (n: string, name: string) => n === name || n.startsWith(`${name} `);
const rest = (n: string, name: string) => n.slice(name.length).trim();

/** `/activity …`: a choice, the window opened on a kind (its format missing), or not understood. */
export function parseActivity(arg: string): { choice: ActivityChoice } | { kind: string } | null {
  const n = norm(arg);
  for (const a of ACTS) {
    const name = a.names.find(x => starts(n, x));
    if (name !== undefined) {
      const r = rest(n, name);
      if (!a.formats) return r ? null : { choice: a.choice! };
      if (!r) return { kind: a.kind };
      return format(a, r);
    }
    for (const f of a.formats ?? []) if (f.names.some(x => starts(n, x))) return format(a, n);   // « /activity tarot »
  }
  return null;
}
function format(a: Act, r: string): { choice: ActivityChoice } | null {
  for (const f of a.formats!) {
    const name = f.names.find(x => starts(r, x));
    if (name === undefined) continue;
    const more = rest(r, name);
    if (!more) return { choice: f.choice };
    if (f.code === 'tarot' && (more === '4' || more === '5')) return { choice: { ...f.choice, tarotPlayers: +more as 4 | 5 } };
    return null;
  }
  return null;
}

/** `/credit-social Léa +100` (or `+ 100`, `-20`): the player and the change; a name alone: the player only. */
export function parseCredit(arg: string, members: MemberView[]): { to: MemberView | null; delta: number | null; name: string } {
  const m = arg.trim().match(/^(.*?)\s*([+\-−])\s*(\d{1,4})$/);
  const name = (m ? m[1]! : arg).trim(), delta = m ? (m[2] === '+' ? 1 : -1) * Number(m[3]) : null;
  const n = norm(name), exact = members.filter(p => norm(p.name) === n), prefix = members.filter(p => norm(p.name).startsWith(n));
  return { to: exact.length === 1 ? exact[0]! : !exact.length && prefix.length === 1 && n ? prefix[0]! : null, delta, name };
}

const item = (label: string, hint: string, fill: string): Suggestion => ({ code: label, cmd: hint, fill, arg: true });

/** What can follow the command being typed (its arguments), or null when it isn't one with arguments. */
export function argSuggestions(draft: string, members: MemberView[], me: string): Suggestion[] | null {
  const m = draft.match(/^\/(\S+)\s(.*)$/s);
  if (!m) return null;
  const cmd = norm(m[1]!), arg = m[2]!, n = norm(arg), done = /\s$/.test(arg);
  if (cmd === 'activity' || cmd === 'activite') {
    const a = ACTS.find(x => x.names.some(name => starts(n, name) && (n !== name || done)));
    if (a?.formats) {
      const name = a.names.find(x => starts(n, x))!, r = rest(n, name);
      const f = a.formats.find(x => x.code === 'tarot' && x.names.some(y => starts(r, y) && (r !== y || done)));
      if (f) return ['4', '5'].map(k => item(`${a.code} tarot ${k}`, `Tarot à ${k}`, `/activity ${a.code} tarot ${k}`));
      return a.formats.filter(x => !r || x.names.some(y => y.startsWith(r))).map(x => item(`${a.code} ${x.code}`, `${a.label} : ${x.label}`, `/activity ${a.code} ${x.code}${x.code === 'tarot' ? ' ' : ''}`));
    }
    if (a) return [];
    return ACTS.filter(x => !n || x.names.some(y => y.startsWith(n)) || x.code.startsWith(n))
      .map(x => item(x.code, x.formats ? `${x.label} : ${x.formats.map(f => f.label).join(', ')}` : x.label, `/activity ${x.code}${x.formats ? ' ' : ''}`));
  }
  if (isEffet(cmd)) {
    const [word = '', ...rest] = arg.split(/\s+/), typing = rest.length === 0 && !done;
    const e = EFFECT_LIST.find(x => (x.names as readonly string[]).includes(norm(word)));
    if (typing || !e) return EFFECT_LIST.filter(x => !n || x.names.some(y => y.startsWith(norm(word)))).map(x => item(x.code, x.label, `/${m[1]} ${x.code}${x.aim === 'no' ? '' : ' '}`));
    if (e.aim === 'no') return [];
    const who = norm(rest.join(' '));
    if (members.some(p => norm(p.name) === who)) return [];
    return members.filter(p => norm(p.name).startsWith(who)).slice(0, 8).map(p => item(p.name, p.id === me ? 'toi' : 'joueur', `/${m[1]} ${e.code} ${p.name}`));
  }
  if (cmd === 'credit social' || cmd === 'credit' || cmd === 'creditsocial' || cmd === 'credit score') {
    const others = members.filter(p => p.id !== me), c = parseCredit(arg, others);
    if (c.delta !== null) return [];
    const exact = others.find(p => norm(p.name) === norm(arg));
    if (exact && done) return ['+10', '+50', '+100', '-10', '-50'].map(v => item(`${exact.name} ${v}`, v.startsWith('+') ? 'accorder' : 'retirer', `/${m[1]} ${exact.name} ${v}`));
    return others.filter(p => norm(p.name).startsWith(n)).slice(0, 8).map(p => item(p.name, 'joueur', `/${m[1]} ${p.name} `));
  }
  return null;
}

/** A command written out with its arguments, ready to run (Enter sends it rather than taking a suggestion). */
export function isComplete(draft: string, members: MemberView[], me: string) {
  const m = draft.match(/^\/(\S+)\s+(.+)$/s);
  if (!m) return false;
  const cmd = norm(m[1]!), arg = m[2]!.trim();
  if (cmd === 'activity' || cmd === 'activite') { const a = parseActivity(arg); return !!a && 'choice' in a; }
  if (cmd === 'credit social' || cmd === 'credit' || cmd === 'creditsocial' || cmd === 'credit score') { const c = parseCredit(arg, members.filter(p => p.id !== me)); return !!c.to && c.delta !== null; }
  if (isEffet(cmd)) return !('error' in parseEffect(arg, members));
  return false;
}

// /effet (openspec: chat-activity, Effets visuels): the effect, its aliases, whether it aims at a player
export const EFFECT_LIST = [
  { code: 'firework', names: ['firework', 'fireworks', 'feu', 'feux', 'artifice'], label: 'feu d\'artifice', aim: 'no' },
  { code: 'confetti', names: ['confetti', 'confeti', 'confettis'], label: 'confettis (à la couleur d\'un joueur si tu le nommes)', aim: 'maybe' },
  { code: 'hit', names: ['hit', 'coup', 'poing'], label: 'un coup de poing sur sa photo', aim: 'yes' },
  { code: 'tomato', names: ['tomato', 'tomate'], label: 'une tomate sur sa photo', aim: 'yes' },
  { code: 'hammer', names: ['hammer', 'marteau'], label: 'un marteau sur sa photo', aim: 'yes' },
  { code: 'screamer', names: ['screamer'], label: 'une image, un sticker, un GIF ou un emoji, 1 s en grand', aim: 'no' },
] as const;
export type EffectCode = typeof EFFECT_LIST[number]['code'];
const isEffet = (cmd: string) => cmd === 'effet' || cmd === 'effect' || cmd === 'effets';

/** `/effet tomato Léa`: the effect and the player aimed at (or what is wrong). */
export function parseEffect(arg: string, members: MemberView[]): { kind: EffectCode; target: MemberView | null } | { error: string } {
  const [word = '', ...rest] = arg.trim().split(/\s+/), name = rest.join(' ');
  const e = EFFECT_LIST.find(x => (x.names as readonly string[]).includes(norm(word)));
  if (!e) return { error: `Effet inconnu : « ${word} ». Effets : ${EFFECT_LIST.map(x => x.code).join(', ')}.` };
  if (e.aim === 'no') return { kind: e.code, target: null };
  if (!name) return e.aim === 'yes' ? { error: `/effet ${e.code} vise un joueur : par exemple /effet ${e.code} ${members[0]?.name ?? 'Léa'}.` } : { kind: e.code, target: null };
  const n = norm(name), exact = members.filter(p => norm(p.name) === n), prefix = members.filter(p => norm(p.name).startsWith(n));
  const to = exact.length === 1 ? exact[0]! : !exact.length && prefix.length === 1 ? prefix[0]! : null;
  return to ? { kind: e.code, target: to } : { error: `Joueur inconnu : « ${name} ».` };
}

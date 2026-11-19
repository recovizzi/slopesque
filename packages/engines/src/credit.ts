// The social credit (openspec: chat-activity, Crédit social): a value of each player in a room, apart from the scores,
// without effect; changed by anyone but oneself, a whole number from 1 to 1000 at once; each change said in the chat
// with a hieroglyph by step (5, 10, 20, 100, cut halfway: up to 7, up to 14, up to 59, then 60 and more).
export const MAX_CHANGE = 1000;

export interface Tier { upTo: number; code: string; name: string }
export const TAKE: Tier[] = [
  { upTo: 7, code: '1301d', name: 'avertissement' }, { upTo: 14, code: '13013', name: 'humiliation' },
  { upTo: 59, code: '1300f', name: 'mise aux fers' }, { upTo: Infinity, code: '13012', name: 'mise à terre' },
];
export const GIVE: Tier[] = [
  { upTo: 7, code: '13020', name: 'encouragement' }, { upTo: 14, code: '13024', name: 'danse' },
  { upTo: 59, code: '1304f', name: 'liesse' }, { upTo: Infinity, code: '1302d', name: 'divinisation' },
];
export const tierOf = (delta: number) => (delta < 0 ? TAKE : GIVE).find(t => Math.abs(delta) <= t.upTo)!;

/** A whole number from 1 to MAX_CHANGE as typed, or null. */
export const amountOf = (s: string) => { const n = Number(s.trim()); return Number.isInteger(n) && n >= 1 && n <= MAX_CHANGE ? n : null; };
export const fmtCredit = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
export const creditWord = (n: number) => (n > 1 ? `${n} crédits sociaux` : `${n} crédit social`);

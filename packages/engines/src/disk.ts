// The Demi-disque (openspec: semicircle-disk, round-flow, amphitheatre-mode). The host writes a word and places his
// ray (0..100) — or picks a column of seats in the Amphithéâtre —, the candidates place theirs within the answer
// time; points by distance; the host scores when the candidates come close. The host's answer stays hidden from the
// others until the reveal (view()). Rules changed during a guessing phase wait for its end.

// ---------------------------------------------------------------- scoring (draft values: design.md question 6)
export const TOLERANCE = 3;        // ± around the host's ray: its thickness, and the « perfect » zone
export const MAX_DISTANCE = 30;    // at or beyond: 0 point
export const MAX_POINTS = 100;
export const PERFECT_BONUS = 50;
export const MAX_COLUMNS = 8;      // Amphithéâtre: at or beyond this many columns, 0 point
export const COLS = 25, ROWS = 7;  // Amphithéâtre: columns of seats, rows
export const seatOf = (col: number, row: number) => col * ROWS + row;
export const colOf = (seat: number) => Math.floor(seat / ROWS);
export const rowOf = (seat: number) => seat % ROWS;

export interface Result { distance: number; points: number; perfect: boolean }

export function score(guess: number, target: number): Result {
  const distance = Math.abs(guess - target);
  if (distance <= TOLERANCE) return { distance, points: MAX_POINTS + PERFECT_BONUS, perfect: true };
  const t = (distance - TOLERANCE) / (MAX_DISTANCE - TOLERANCE);
  return { distance, points: Math.max(0, Math.round(MAX_POINTS * (1 - t))), perfect: false };
}

export function scoreSeat(col: number, target: number): Result {
  const distance = Math.abs(col - target);
  if (distance === 0) return { distance, points: MAX_POINTS + PERFECT_BONUS, perfect: true };
  return { distance, points: Math.max(0, Math.round(MAX_POINTS * (1 - (distance - 1) / (MAX_COLUMNS - 1)))), perfect: false };
}

/** The host's points: how close the candidates came on average, 100 on the answer down to 0 at `max`. */
export function hostScore(distances: number[], max: number): number {
  if (!distances.length) return 0;
  return Math.round(MAX_POINTS * distances.reduce((s, d) => s + Math.max(0, 1 - d / max), 0) / distances.length);
}

// ---------------------------------------------------------------- the round
export type DiskMode = 'ray' | 'amphi';
export type DiskPhase = 'lobby' | 'writing' | 'guessing' | 'reveal';
export const ROUND_SECONDS = [15, 30, 60] as const;
export interface DiskRules { topic: string; left: string; right: string; roundSeconds: (typeof ROUND_SECONDS)[number]; mode: DiskMode }
export const DEFAULT_RULES: DiskRules = { topic: 'Les pays ?', left: 'de gauche', right: 'de droite', roundSeconds: 30, mode: 'ray' };

export interface DiskState {
  rules: DiskRules;
  pending: Partial<DiskRules> | null;   // changed during a guessing phase: applied at its end
  round: number;
  phase: DiskPhase;
  word: string;
  mode: DiskMode;                       // the round's (fixed when it starts)
  target: number | null;                // the host's ray (0..100) or column (0..COLS-1)
  host: string | null;                  // the round's host
  guesses: Record<string, number>;      // validated rays or seats
  results: Record<string, Result>;
  hostPoints: number | null;
  deadline: number | null;
}

export const newDisk = (rules: DiskRules = DEFAULT_RULES): DiskState =>
  ({ rules, pending: null, round: 1, phase: 'lobby', word: '', mode: rules.mode, target: null, host: null, guesses: {}, results: {}, hostPoints: null, deadline: null });

export class DiskError extends Error {}

const validRay = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;
const validSeat = (v: number) => Number.isInteger(v) && v >= 0 && v < COLS * ROWS;
const validColumn = (v: number) => Number.isInteger(v) && v >= 0 && v < COLS;

/** The host's rules: now, or at the end of the guessing phase. */
export function setRules(s: DiskState, changes: Partial<DiskRules>): { state: DiskState; now: boolean } {
  if (s.phase === 'guessing') return { state: { ...s, pending: { ...s.pending, ...changes } }, now: false };
  return { state: { ...s, rules: { ...s.rules, ...changes } }, now: true };
}

/** The host starts a round: his word and his answer (ray or column). */
export function startRound(s: DiskState, host: string, word: string, target: number, now = Date.now()): DiskState {
  if (s.phase === 'guessing') throw new DiskError('Un tour est déjà en cours.');
  const w = word.trim();
  if (!w || w.length > 40) throw new DiskError('Un mot de 1 à 40 caractères.');
  const mode = s.rules.mode;
  if (mode === 'ray' ? !validRay(target) : !validColumn(target)) throw new DiskError('Place ta réponse sur le demi-disque.');
  return { ...s, phase: 'guessing', word: w, mode, target: mode === 'ray' ? Math.round(target * 10) / 10 : target, host,
    guesses: {}, results: {}, hostPoints: null, deadline: now + s.rules.roundSeconds * 1000 };
}

/** A candidate validates his ray or seat (once; a seat taken by another is refused). */
export function guess(s: DiskState, who: string, value: number): DiskState {
  if (s.phase !== 'guessing') throw new DiskError('Le placement est terminé.');
  if (who === s.host) throw new DiskError('L\'hôte ne place pas de rayon pendant le tour.');
  if (who in s.guesses) throw new DiskError('Tu as déjà validé.');
  if (s.mode === 'ray' ? !validRay(value) : !validSeat(value)) throw new DiskError('Place-toi sur le demi-disque.');
  if (s.mode === 'amphi' && Object.values(s.guesses).includes(value)) throw new DiskError('Ce siège vient d\'être pris.');
  return { ...s, guesses: { ...s.guesses, [who]: s.mode === 'ray' ? Math.round(value * 10) / 10 : value } };
}

export const allValidated = (s: DiskState, candidates: string[]) => candidates.length > 0 && candidates.every(id => id in s.guesses);

/** The end of the guessing phase: each candidate's points, the host's, the pending rules applied. */
export function reveal(s: DiskState): { state: DiskState; points: Record<string, number>; best: [string, Result] | null } {
  if (s.phase !== 'guessing' || s.target === null) return { state: s, points: {}, best: null };
  const results: Record<string, Result> = {};
  for (const [id, v] of Object.entries(s.guesses)) results[id] = s.mode === 'amphi' ? scoreSeat(colOf(v), s.target) : score(v, s.target);
  const hostPoints = hostScore(Object.values(results).map(r => r.distance), s.mode === 'amphi' ? MAX_COLUMNS : MAX_DISTANCE);
  const points = Object.fromEntries(Object.entries(results).map(([id, r]) => [id, r.points]));
  if (s.host) points[s.host] = (points[s.host] ?? 0) + hostPoints;
  const best = Object.entries(results).sort((a, b) => b[1].points - a[1].points)[0] ?? null;
  return { state: { ...s, phase: 'reveal', results, hostPoints, deadline: null, rules: { ...s.rules, ...s.pending }, pending: null }, points, best };
}

export function nextRound(s: DiskState): DiskState {
  return { ...s, round: s.phase === 'lobby' ? s.round : s.round + 1, phase: 'writing', word: '', target: null, guesses: {}, results: {}, hostPoints: null, deadline: null,
    rules: { ...s.rules, ...s.pending }, pending: null };
}

/** What a player may see: the host's answer only for the host during the round, for everyone at the reveal. */
export function diskView(s: DiskState, viewer: string): DiskState {
  return s.phase === 'guessing' && viewer !== s.host ? { ...s, target: null } : s;
}

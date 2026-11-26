// What a round of the Demi-disque shows to me (openspec: round-flow, semicircle-disk, amphitheatre-mode): my role, the
// board of the round (rays or seats), whether I may pick, what is drawn on it, the results. Pure: the server decides
// (it never sends the host's answer before the reveal), the stage only shows.
import type { DiskView } from '@slopesque/shared';
import type { ColumnMark, SeatMark } from './amphi-model';
import type { Ray } from './model';

export type Role = 'host' | 'candidate' | 'spectator';
export type Mode = DiskView['mode'];

/** The host, a candidate (playing), or a spectator. */
export function roleOf(hostId: string | null, me: string, playing: boolean): Role {
  return hostId === me ? 'host' : playing ? 'candidate' : 'spectator';
}

/** The round's board: fixed when the round starts, the rules' until then. */
export const modeOf = (d: DiskView): Mode => (d.phase === 'guessing' || d.phase === 'reveal' ? d.mode : d.rules.mode);

const answering = (d: DiskView) => d.phase === 'guessing' || d.phase === 'reveal';

/** The host places his answer before the round; a candidate his own while guessing, until he validates it. */
export function canPick(d: DiskView, role: Role, me: string) {
  return (
    ((d.phase === 'writing' || d.phase === 'lobby') && role === 'host') ||
    (d.phase === 'guessing' && role === 'candidate' && !(me in d.guesses))
  );
}

/** How the board names and colours the players. */
export interface Painter {
  color: (id: string) => string;
  name: (id: string) => string;
  hostColor: string;
  hostName: string;
}

/** I picked, not validated yet: shown as mine, « non validé ». */
const pending = (d: DiskView, role: Role, me: string, pick: number | null): pick is number =>
  d.phase === 'guessing' && role === 'candidate' && !(me in d.guesses) && pick !== null;

/** The disk's rays: the host's while he places it, then (once the round started) his as the target — the server
 *  sends it at the reveal only —, the validated ones, mine not validated yet. */
export function diskRays(d: DiskView, role: Role, me: string, pick: number | null, p: Painter): Ray[] {
  const rays: Ray[] = [];
  if (!answering(d) && role === 'host' && pick !== null)
    rays.push({ id: 'target', value: pick, color: p.hostColor, kind: 'target' });
  if (d.target !== null && answering(d))
    rays.push({ id: 'target', value: d.target, color: p.hostColor, kind: 'target', label: `${p.hostName} (hôte)` });
  for (const [id, v] of Object.entries(d.guesses))
    rays.push({ id, value: v, color: p.color(id), kind: id === me ? 'mine' : 'player', label: p.name(id) });
  if (pending(d, role, me, pick))
    rays.push({ id: me, value: pick, color: p.color(me), kind: 'mine', label: 'Toi (non validé)' });
  return rays;
}

/** The Amphithéâtre's marks: the host's column (filled while he chooses it, then a band), the seats taken, mine
 *  not validated yet. */
export function amphiMarks(d: DiskView, role: Role, me: string, pick: number | null, p: Painter) {
  let column: ColumnMark | null = null;
  if (!answering(d) && role === 'host' && pick !== null) column = { col: pick, color: p.hostColor, style: 'fill' };
  else if (d.target !== null) column = { col: d.target, color: p.hostColor, style: 'band' };
  const seats: SeatMark[] = Object.entries(d.guesses).map(([id, s]) => ({
    seat: s,
    color: p.color(id),
    kind: id === me ? 'mine' : 'player',
    label: p.name(id),
  }));
  if (pending(d, role, me, pick))
    seats.push({ seat: pick, color: p.color(me), kind: 'pending', label: 'Toi (non validé)' });
  return { column, seats };
}

/** Someone validated the seat I had picked first (Amphithéâtre): my pick is lost. */
export function seatLost(d: DiskView, me: string, pick: number | null) {
  return (
    d.phase === 'guessing' &&
    modeOf(d) === 'amphi' &&
    pick !== null &&
    !(me in d.guesses) &&
    Object.values(d.guesses).includes(pick)
  );
}

/** How far a result is from the host's answer: in columns (Amphithéâtre), in degrees (value × 1.8). */
export const gapText = (mode: Mode, x: number) =>
  mode === 'amphi' ? (x === 0 ? 'dans la colonne' : `à ${x} colonne${x > 1 ? 's' : ''}`) : `à ${Math.round(x * 1.8)}°`;

/** The results, best first. */
export const rankedResults = (d: DiskView) => Object.entries(d.results).sort((a, b) => b[1].points - a[1].points);

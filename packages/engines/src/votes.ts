// Votes launched from the chat (openspec: chat-activity, Votes dans le chat): 2 minutes, the voters are the players
// connected at the start (not the one a /kick is about), it counts when at least half of them voted (rounded up), the
// majority wins (a tie: no), one vote at a time per room; who launches it votes yes; anyone may change his vote.
export const VOTE_MS = 2 * 60_000;
export const KICK_AFTER_MS = 30_000;

export type VoteKind = 'activity' | 'host' | 'kick';
export type VoteResult = 'yes' | 'no' | 'quorum' | 'cancelled';
export interface Vote {
  kind: VoteKind;
  by: string;
  target?: string;          // host: who asks for the role; kick: the player to make leave the table
  choice?: Record<string, unknown>;   // activity: what is proposed
  label: string;            // after the name of who launched it: « propose de passer au Tarot à 5 »
  yes: string[]; no: string[];
  voters: string[];
  ends: number;
  result?: VoteResult;
}

export const needed = (v: Pick<Vote, 'voters'>) => Math.ceil(v.voters.length / 2);

export function startVote(v: Omit<Vote, 'yes' | 'no' | 'voters' | 'ends'>, connected: string[], now = Date.now()): Vote {
  const voters = connected.filter(id => !(v.kind === 'kick' && id === v.target));
  return { ...v, yes: voters.includes(v.by) ? [v.by] : [], no: [], voters, ends: now + VOTE_MS };
}

/** A vote cast (or changed); `done` when everyone has voted (the vote then ends at once). */
export function castVote(v: Vote, who: string, yes: boolean): { vote: Vote; done: boolean } | null {
  if (v.result || !v.voters.includes(who)) return null;
  const next = { ...v, yes: v.yes.filter(x => x !== who), no: v.no.filter(x => x !== who) };
  (yes ? next.yes : next.no).push(who);
  return { vote: next, done: next.yes.length + next.no.length === next.voters.length };
}

export function closeVote(v: Vote, now = Date.now()): Vote {
  if (v.result) return v;
  const n = v.yes.length + v.no.length;
  return { ...v, ends: Math.min(v.ends, now), result: n < needed(v) ? 'quorum' : v.yes.length > v.no.length ? 'yes' : 'no' };
}

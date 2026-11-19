// A card table's seats (openspec: card-games, Regarder, rejoindre ou quitter une table). The engine plays seats (s0,
// s1…): a player sits there, or a robot plays it. The round's points go to the last player who sat there during the
// round; a seat left mid-round keeps its player's name (with the robot icon) until the round ends, then a robot's name.
export interface CardSeat {
  id: string;
  user: string | null;     // the player sitting there now; null: a robot plays the seat
  credit: string | null;   // who gets this round's points
  bot: string;             // the robot's name
}

const ROBOT_NAMES = ['Boulon', 'Biscotte', 'Pixel', 'Nougat', 'Gaston', 'Clafoutis', 'Pépin', 'Tic-Tac', 'Zinzin', 'Grelot'];
export function robotName(seats: CardSeat[]) {
  const free = ROBOT_NAMES.filter(n => !seats.some(s => s.bot === n));
  return free[crypto.getRandomValues(new Uint32Array(1))[0]! % Math.max(1, free.length)] ?? 'Robot';
}

/** The seats of a new table: the players who play, then robots up to `min`. */
export function seatTable(players: string[], min = 3): CardSeat[] {
  const seats: CardSeat[] = [];
  for (const [i, u] of players.entries()) seats.push({ id: `s${i}`, user: u, credit: u, bot: '' });
  while (seats.length < min) seats.push({ id: `s${seats.length}`, user: null, credit: null, bot: '' });
  for (const s of seats) s.bot = robotName(seats);
  return seats;
}

export const seatOfUser = (seats: CardSeat[], user: string) => seats.find(s => s.user === user) ?? null;

/** A player takes a seat a robot plays (his own first): at once, with the hand in progress; its points become his. */
export function join(seats: CardSeat[], user: string): { seats: CardSeat[]; seat: CardSeat; was: { name: string; owner: string | null } } | 'full' | 'seated' {
  if (seatOfUser(seats, user)) return 'seated';
  const free = seats.filter(s => !s.user);
  if (!free.length) return 'full';
  const s = free.find(x => x.credit === user) ?? free[0]!;
  const was = { name: s.bot, owner: s.credit };
  const next = seats.map(x => (x.id === s.id ? { ...x, user, credit: user } : x));
  return { seats: next, seat: next.find(x => x.id === s.id)!, was };
}

/** A player leaves: a robot plays his seat; during a round his name and the round's points stay. */
export function leave(seats: CardSeat[], user: string, inRound: boolean): CardSeat[] {
  return seats.map(s => (s.user !== user ? s : inRound ? { ...s, user: null } : { ...s, user: null, credit: null, bot: robotName(seats) }));
}

/** The end of a round: a seat a robot played for a player who left gets a robot's name, nobody's points. */
export function settle(seats: CardSeat[]): { seats: CardSeat[]; freed: string[] } {
  const freed: string[] = [];
  const next = seats.map(s => { if (s.user || !s.credit) return s; freed.push(s.credit); return { ...s, credit: null, bot: robotName(seats) }; });
  return { seats: next, freed };
}

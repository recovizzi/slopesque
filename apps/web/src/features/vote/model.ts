// What a vote of the chat says, without React (model.test.ts): its time left, its count.

/** The time left, m:ss (never below 0:00). */
export const fmtLeft = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Yes, no, how many votes it needs to count, among how many players connected at its start. */
export const voteCount = (yes: number, no: number, need: number, voters: number) =>
  `Oui ${yes} · Non ${no} · il faut ${need} vote${need > 1 ? 's' : ''} pour que ça compte (${voters} connecté${voters > 1 ? 's' : ''})`;

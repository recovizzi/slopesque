// A message starting with « / » is a command, not a message to everyone (openspec: chat-activity, Commandes): which
// one (its accents and case left out, its other names), and its argument. Their arguments: lib/commands.ts. Run by
// composer/useSend.ts.

export type CommandName = 'activity' | 'credit' | 'effect' | 'host' | 'kick';
const NAMES: Record<string, CommandName> = {
  activity: 'activity',
  activite: 'activity',
  'credit-social': 'credit',
  credit: 'credit',
  creditsocial: 'credit',
  'credit-score': 'credit',
  effet: 'effect',
  effect: 'effect',
  effets: 'effect',
  hote: 'host',
  host: 'host',
  kick: 'kick',
};

/** `/word the rest`: the command (null: unknown), the word as typed, the rest. */
export function parseCommand(text: string): { name: CommandName | null; word: string; arg: string } {
  const [word = '', ...rest] = text.slice(1).trim().split(/\s+/);
  const key = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return { name: NAMES[key] ?? null, word, arg: rest.join(' ') };
}

/** `/effet screamer 😱`: what follows « screamer », when it is an emoji (or a `:code:`), not a word. */
export function screamEmoji(arg: string): string | null {
  const e = arg.trim().split(/\s+/).slice(1).join(' ').trim();
  return e && !/[\p{L}\p{N}]/u.test(e.replace(/^:[a-z0-9_]+:$/, '')) ? e : null;
}

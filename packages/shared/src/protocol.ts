// The WebSocket protocol (Socket.IO) between the panel and the server (openspec: realtime-sync). The client sends
// intents, validated here with zod on the server; the server answers by acknowledgements and sends the room's full
// state, then numbered events. A client that sees a gap in the numbers asks for the full state again.
import { z } from 'zod';

// ------------------------------------------------------------------ handshake
/** Sent in Socket.IO's `auth` (never in the address). */
/** A GIF sent or kept: a link to its provider, https on KLIPY or GIPHY only (never javascript:, data:, nor a tracker). */
export const gifUrl = z.url().refine(u => /^https:\/\/([a-z0-9-]+\.)*(klipy\.com|giphy\.com)\//i.test(u), 'Lien de GIF refusé.');
const gifRef = z.object({ id: z.string().max(64), provider: z.string().max(16), url: gifUrl, w: z.number().int(), h: z.number().int(), title: z.string().max(200) });
export const handshakeSchema = z.object({ code: z.string().min(1).max(64), protocol: z.number().int(), version: z.string().max(32).optional() });   // version: the extension's
/** « 0.10.2 » < « 0.11.0 »: versions compared number by number. */
export function versionBelow(a: string, b: string) {
  const x = a.split('.').map(n => parseInt(n, 10) || 0), y = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0); }
  return false;
}
export type Handshake = z.infer<typeof handshakeSchema>;

/** Why the server refuses or ends a connection (the panel shows the French text it maps to). */
export type FatalReason = 'protocol' | 'outdated' | 'code' | 'retired' | 'limited' | 'replaced';   // outdated: the extension is older than the server accepts

// ------------------------------------------------------------------ data sent to the client
export interface AccountView {
  id: string;
  name: string;
  gifFavorites: GifRef[];
  hue: number | null;
  quick: string | null;
  rooms: SavedRoom[];
}
export interface SavedRoom { key: string; name: string; pending: boolean }

export type Presence = 'here' | 'away' | 'gone';
export interface MemberView {
  id: string;
  name: string;
  hue: number;
  photo: string | null;
  presence: Presence;
  awaySince: number | null;
  playing: boolean;
  scores: Record<string, number>;   // the ranking of each game: disk, tdc, tarot (scoreKey)
  credit: number;
  joinedAt: number;
}

/** A quoted message: what a reply shows above itself; `gone` once the quoted one is deleted (30 days). */
export interface Quote { id: number; from: string | null; text: string; kind: string; gone: boolean; expired?: boolean }   // expired: a chat image past its week
export interface MessageView {
  id: number;
  from: string | null;             // null: the room (system)
  kind: 'text' | 'system' | 'media' | 'vote' | 'credit' | 'poll';   // poll: a poll continued in the chat (data.chatPoll)
  text: string;
  at: number;
  reply: Quote | null;
  reactions: Record<string, string[]>;
  media?: MediaView | null;
  preview?: LinkPreview | null;    // the first link's preview, read by the server (arrives after the message)
  data?: Record<string, unknown> | null;
  scope?: string | null;           // a game's system line: shown only during that activity's session (RoomState.scope)
}
/** A picture in a message: src null once it is gone (a chat image after 7 days, a sticker removed). A GIF is a link
 *  to its provider (not stored): `gif` says which. */
export interface MediaView { kind: 'image' | 'sticker' | 'gif'; src: string | null; w: number; h: number; gif?: GifRef | null }
export interface GifRef { id: string; provider: string; url: string; w: number; h: number; title: string }
export interface LinkPreview { kind: 'card' | 'video'; url: string; site: string; title: string; text?: string; image?: string | null; embed?: string | null }
export interface StickerView { id: string; src: string; w: number; h: number }
export interface EmojiView { name: string; url: string; by: string | null }
export interface ChatPage {
  messages: MessageView[];
  hasMore: boolean;
  /** At the top of the chat when nothing older remains: « Début de la conversation », or older messages deleted. */
  start: 'begin' | 'purged' | null;
  /** A join with the last message the device kept (`after`): only what follows `since` is sent (the new messages and a
   *  refresh of the last ones kept); the device keeps the rest. Absent: the page replaces what the device had. */
  since?: number | null;
}

export interface RoomState {
  seq: number;
  room: { key: string; name: string; createdAt: number };
  me: string;
  hostId: string | null;
  members: MemberView[];
  chat: ChatPage;
  stickers: StickerView[];
  emoji: EmojiView[];
  activity: ActivityChoice;
  scope: string;                   // the activity's session (« cards#12 »): its system lines are shown during it only
  notice?: { id: string; title: string; text: string } | null;   // the server restarted during a game: it is lost (a window, once)
  disk: DiskView;
  poll: PollView;
  wheel: WheelView;
  cards: CardsView;
  web: Record<string, string>;   // each integration's address, checked by the host (default: its own)
  serverTime: number;
}

/** What the server says right after a connection is accepted. */
export interface Hello { account: AccountView; protocol: number; serverTime: number; insecure: boolean; server: ServerVersions }
/** What the server says of the versions: its own, the oldest extension it accepts, the latest release to download. */
export interface ServerVersions { version: string; minExtension: string; download: string }

export type RoomEvent =
  | { type: 'message'; message: MessageView }
  | { type: 'message-removed'; id: number }
  | { type: 'reactions'; id: number; reactions: Record<string, string[]> }
  | { type: 'member'; member: MemberView }
  | { type: 'host'; hostId: string | null }
  | { type: 'message-updated'; message: MessageView }
  | { type: 'stickers'; stickers: StickerView[] }
  | { type: 'emoji'; emoji: EmojiView[] }
  | { type: 'activity'; activity: ActivityChoice; scope: string }
  | { type: 'disk'; disk: DiskView }
  | { type: 'poll'; poll: PollView }
  | { type: 'wheel'; wheel: WheelView }
  | { type: 'cards'; cards: CardsView }
  | { type: 'web'; web: Record<string, string> };

export interface PlayingCard { id: string; r: number; s: 'S' | 'H' | 'D' | 'C' }
export interface CardSeatView { id: string; user: string | null; credit: string | null; bot: string }
/** The Trou du cul's round as a seat sees it (the others' hands as backs: hidden cards with r = 0). */
export interface TdcRoundView {
  seats: string[]; hands: Record<string, PlayingCard[]>; trick: { by: string; cards: PlayingCard[] }[]; lastTrick: { by: string; cards: PlayingCard[] }[];
  turn: string | null; passed: string[]; out: string[]; roles: Record<string, 'president' | 'vice' | 'neutre' | 'vtdc' | 'tdc'>; round: number; startedAt: number; exchanges: string[];
}
export interface TarotCardView { id: string; kind: 'suit' | 'trump' | 'excuse'; r: number; s?: 'S' | 'H' | 'D' | 'C' }
/** The Tarot's deal as a seat sees it (engines' tarotView: the others' hands as backs, the partner once revealed). */
export interface TarotDealView {
  seats: string[]; hands: Record<string, TarotCardView[]>; chien: TarotCardView[]; phase: 'bid' | 'call' | 'dog' | 'play' | 'done';
  called: TarotCardView | null; partner: string | null; revealed: boolean; bids: Record<string, string>; turn: string | null; taker: string | null;
  bid: string | null; ecart: TarotCardView[]; trick: { by: string; card: TarotCardView }[]; lastTrick: { by: string; card: TarotCardView }[];
  won: Record<string, TarotCardView[]>; tricks: Record<string, { by: string; card: TarotCardView }[][]>; lastWinner: string | null; deal: number; startedAt: number;
  result: { taker: string; partner: string | null; bid: string; bouts: number; need: number; made: number; won: boolean; score: number; marks: Record<string, number>; petit: 'taker' | 'defense' | null; handfuls: number; chelem: number } | null; note: string;
  shownChien: TarotCardView[]; chelem: string | null; handfuls: Record<string, { level: 1 | 2 | 3; cards: TarotCardView[] }>; started: string[]; winners: string[];
}
/** The Hold'em's game as a seat sees it (engines' holdemView: the others' cards as backs until turned over). */
export interface HoldemView {
  seats: string[]; settings: HoldemRules; stacks: Record<string, number>; out: string[]; places: Record<string, number>; over: boolean;
  hand: number; level: number; sb: number; bb: number; levelUp: boolean; button: string | null; sbSeat: string | null; bbSeat: string | null;
  holes: Record<string, PlayingCard[]>; board: PlayingCard[]; street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  inHand: string[]; folded: string[]; bets: Record<string, number>; paid: Record<string, number>; current: number; minRaise: number;
  acted: string[]; faced: Record<string, number>; aggressor: string | null; turn: string | null;
  last: Record<string, { act: HoldemAct; amount: number }>; log: { by: string; street: string; act: HoldemAct; amount: number }[];
  revealed: boolean; startStacks: Record<string, number>; startedAt: number;
  result: { awards: { amount: number; winners: string[]; hand: string; side: number }[]; uncontested: boolean; shown: string[];
    best: Record<string, { cat: number; name: string; five: string[] }>; won: Record<string, number>; out: string[] } | null;
}
export type HoldemAct = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'sb' | 'bb';
/** The Hold'em's game: the starting chips, the blinds up every N hands (0: never). */
export interface HoldemRules { stack: number; every: number }
export const HOLDEM_STACKS = [500, 1000, 2000, 5000] as const;
export const HOLDEM_EVERY = [5, 10, 20, 0] as const;
/** The Coinche's deal as a seat sees it (engines' coincheView: the others' hands as backs). */
export interface CoincheView {
  seats: string[]; dealer: string; hands: Record<string, PlayingCard[]>; phase: 'bid' | 'play' | 'done';
  speeches: ({ by: string; kind: 'pass' | 'coinche' | 'surcoinche' } | { by: string; kind: 'bid'; value: number; suit: 'S' | 'H' | 'D' | 'C' })[];
  contract: { by: string; value: number; suit: 'S' | 'H' | 'D' | 'C'; mult: 1 | 2 | 4 } | null; passes: number; coincheBy: string | null; answer: string[]; turn: string | null;
  trick: { by: string; card: PlayingCard }[]; lastTrick: { by: string; card: PlayingCard }[]; lastWinner: string | null; tricks: Record<string, { by: string; card: PlayingCard }[][]>;
  winners: string[]; belote: { by: string | null; said: number }; scores: [number, number]; target: number; deal: number; startedAt: number;
  result: { attack: 0 | 1; contract: { by: string; value: number; suit: 'S' | 'H' | 'D' | 'C'; mult: 1 | 2 | 4 }; points: [number, number]; belote: 0 | 1 | null; made: boolean; score: [number, number]; capot: 0 | 1 | null } | null;
  history: { deal: number; contract: { by: string; value: number; suit: 'S' | 'H' | 'D' | 'C'; mult: 1 | 2 | 4 } | null; score: [number, number] }[];
  note: string; over: boolean; winner: 0 | 1 | null;
}
export const COINCHE_TARGETS = [1000, 1500, 2000] as const;
/** How many seats each card game can have (robots complete the free ones). */
export const CARD_PLAYERS = { tdc: [3, 4, 5, 6, 7, 8], tarot: [4, 5], holdem: [2, 3, 4, 5, 6, 7, 8], coinche: [4] } as const;
export type CardGameKey = keyof typeof CARD_PLAYERS;
export interface CardsView {
  game: CardGameKey;
  players: number;                       // the seats of the table on the table now
  settings: { tdc: number; tarot: number; holdem: number; coinche: number; bots?: 'facile' | 'moyen' | 'fort'; holdemRules?: HoldemRules; coincheTarget?: number };   // the host's choice for each game, from the next deal; bots: the robots' level
  showTricks: boolean;                   // Tarot: the won tricks can be looked at
  seats: CardSeatView[];
  tdc: TdcRoundView | null;
  tarot: TarotDealView | null;
  holdem: HoldemView | null;
  coinche: CoincheView | null;
  paid: Record<string, string | null>;   // the last round: who got each seat's points (null: a robot)
  turnSince: number;
  late: { seat: string; user: string; secs: number } | null;   // a player's turn has lasted 30 s: /kick possible
  art: Record<string, string>;           // Tarot: the room's pictures of the trumps (« 0 » the Excuse … « 21 »), their address
}
export const READY_CARD_GAMES = ['tdc', 'tarot', 'holdem', 'coinche'];
/** The card game an activity choice plays (the Trou du cul by default). */
export const cardGameOf = (a: { cardGame?: string }): CardGameKey => (a.cardGame === 'tarot' || a.cardGame === 'holdem' || a.cardGame === 'coinche' ? a.cardGame : 'tdc');
/** /effet: a visual effect on everyone's screen (not kept). On a player's photo: hit, tomato, hammer. */
export const EFFECTS = ['firework', 'confetti', 'hit', 'tomato', 'hammer', 'screamer'] as const;
export type EffectKind = typeof EFFECTS[number];
export const ON_PHOTO: readonly EffectKind[] = ['hit', 'tomato', 'hammer'];
/** How long each effect plays (ms): the server counts the ones running; 3 at a time for these two, else 1. */
export const EFFECT_MS: Record<EffectKind, number> = { firework: 4200, confetti: 3800, hit: 2300, tomato: 2900, hammer: 2900, screamer: 1300 };
export const EFFECT_PARALLEL: Partial<Record<EffectKind, number>> = { firework: 3, confetti: 3 };
/** An effect sent to the room's players (the « fx » channel, outside the numbered events: a missed one is not replayed). */
export interface EffectView { id: string; kind: EffectKind; by: string; target: string | null; hue: number | null; pic: { kind: 'image' | 'emoji'; src: string } | null }
/** The ranking an activity shows (and resets): each game its own; null: an activity without points. */
export const scoreKey = (a: { activity: string; cardGame?: string }) => (a.activity === 'disk' ? 'disk' : a.activity === 'cards' ? cardGameOf(a) : null);
export const SCORE_NAMES: Record<string, string> = { disk: 'du Demi-disque', tdc: 'du Trou du cul', tarot: 'du Tarot', holdem: 'du Texas Hold\'em', coinche: 'de la Coinche' };
/** One player's result in one round (the Palmarès, kept with the room). */
export interface PalmaresEvent { at: number; game: 'disk' | 'tdc' | 'tarot' | 'holdem' | 'coinche'; id: string; name: string; hue: number; won: boolean; pts?: number; perfect?: boolean; role?: string; taker?: boolean; partner?: boolean; place?: number; of?: number; humans?: number }

export type PollAnswer = number | string | [number, number];
export interface PollPicView { kind: 'image' | 'sticker' | 'gif'; src: string; w: number; h: number }
/** The Sondage as a player sees it: during the poll, only who answered and my own answer; then everything (names
 *  hidden when secret). */
/** A poll continued in the chat (the activity changed while it was open): answered there, its results shown there.
 *  While open, who answered (not what); closed, the answers (anonymous when secret) and the outcome. */
export interface ChatPollView {
  poll: NonNullable<PollView['poll']>; round: number; host: string | null; secret: boolean; seconds: number; deadline: number;
  answered: string[]; closed: boolean; answers: Record<string, PollAnswer> | null; outcome: PollView['outcome'];
}
export interface PollView {
  phase: 'writing' | 'open' | 'results';
  round: number;
  seconds: number;
  secret: boolean;
  poll: { kind: 'choices' | 'free' | 'gradient'; question: string; choices: string[]; pics: (PollPicView | null)[] } | null;
  answered: string[];
  mine: PollAnswer | null;
  answers: Record<string, PollAnswer> | null;
  outcome: { ranked: { key: string; label: string; ids: string[]; value: number }[]; winner: string | null; hostEdge: boolean; tie: boolean } | null;
  deadline: number | null;
}
export interface WheelItemView { label: string; weight: string }
export interface SpinView { items: WheelItemView[]; shares: number[]; angle: number; winner: number; at: number; from: number }
/** The Roulette: the wheel being built (everyone sees it), the draw decided by the server. */
export interface WheelView { phase: 'writing' | 'spinning' | 'result'; items: WheelItemView[]; spin: SpinView | null; needle: number; round: number }   // round: the draw's number
export const POLL_DURATIONS = [180, 300, 900, 1800, 3600, 10800] as const;

/** The Demi-disque as a player sees it (the host's answer hidden from the others until the reveal): engines' DiskState. */
export interface DiskView {
  rules: { topic: string; left: string; right: string; roundSeconds: 15 | 30 | 60; mode: 'ray' | 'amphi' };
  pending: Partial<DiskView['rules']> | null;
  round: number;
  phase: 'lobby' | 'writing' | 'guessing' | 'reveal';
  word: string;
  mode: 'ray' | 'amphi';
  target: number | null;
  host: string | null;
  guesses: Record<string, number>;
  results: Record<string, { distance: number; points: number; perfect: boolean }>;
  hostPoints: number | null;
  deadline: number | null;
}

/** An activity and its format (/activity, the host's choice). Only the activities in READY_ACTIVITIES can be chosen. */
export const activityChoice = z.object({
  activity: z.enum(['chat', 'disk', 'poll', 'wheel', 'cards', 'lowtide']),
  mode: z.enum(['ray', 'amphi']).optional(),
  cardGame: z.enum(['tdc', 'tarot', 'holdem', 'coinche']).optional(),
  tarotPlayers: z.union([z.literal(4), z.literal(5)]).optional(),
});
export type ActivityChoice = z.infer<typeof activityChoice>;
/** The activities the V1 can play now (grows with the milestones). */
export const READY_ACTIVITIES: ActivityChoice['activity'][] = ['chat', 'disk', 'poll', 'wheel', 'cards', 'lowtide'];
export type SequencedEvent = RoomEvent & { seq: number };

// ------------------------------------------------------------------ intents (client → server), with their answers
export const MAX_TEXT = 500;
export const intents = {
  'room:check': z.object({ key: z.string().max(16) }),
  'room:join': z.object({ key: z.string().max(16), after: z.number().int().nonnegative().optional() }),
  'room:leave': z.object({}),
  'chat:history': z.object({ before: z.number().int().positive() }),
  'chat:send': z.object({ text: z.string().trim().min(1).max(MAX_TEXT), replyTo: z.number().int().positive().nullable().optional() }),
  'chat:react': z.object({ id: z.number().int().positive(), emoji: z.string().min(1).max(64) }),
  'profile:update': z.object({ name: z.string().trim().max(20).optional(), hue: z.number().int().min(0).max(359).nullable().optional(), quick: z.string().max(32).nullable().optional() }),
  'rooms:save': z.object({ rooms: z.array(z.object({ key: z.string().max(16), name: z.string().max(40), pending: z.boolean() })).max(100) }),
  'account:find': z.object({ code: z.string().max(64), resume: z.boolean().optional() }),   // resume: taking an account back (its wrong codes count)
  'account:renew': z.object({ code: z.string().max(64) }),
  'host:give': z.object({ to: z.string().uuid() }),
  'media:ticket': z.object({ usage: z.enum(['chat', 'sticker', 'emoji', 'photo', 'poll', 'trump']) }),
  'chat:media': z.object({ mediaId: z.string().uuid(), text: z.string().trim().max(MAX_TEXT).optional(), replyTo: z.number().int().positive().nullable().optional() }),   // text: what is written with the picture
  'chat:gif': z.object({ gif: gifRef, text: z.string().trim().max(MAX_TEXT).optional(), replyTo: z.number().int().positive().nullable().optional() }),
  'sticker:add': z.object({ mediaId: z.string().uuid(), send: z.boolean() }),
  'sticker:send': z.object({ id: z.string().uuid(), text: z.string().trim().max(MAX_TEXT).optional(), replyTo: z.number().int().positive().nullable().optional() }),
  'sticker:remove': z.object({ id: z.string().uuid() }),
  'emoji:add': z.object({ name: z.string().regex(/^[a-z0-9_]{2,24}$/), mediaId: z.string().uuid() }),
  'photo:set': z.object({ mediaId: z.string().uuid().nullable() }),
  'gif:search': z.object({ q: z.string().trim().min(1).max(60), page: z.number().int().min(0).max(100_000), provider: z.string().max(16).nullable().optional() }),
  'gif:trending': z.object({ page: z.number().int().min(0).max(100_000), provider: z.string().max(16).nullable().optional() }),
  'vote:cast': z.object({ id: z.number().int().positive(), yes: z.boolean() }),
  'host:ask': z.object({}),
  'activity:choose': z.object({ choice: activityChoice }),
  'credit:give': z.object({ to: z.string().uuid(), delta: z.number().int().min(-1000).max(1000).refine(n => n !== 0) }),
  'kick:ask': z.object({ name: z.string().max(20).optional() }),
  'disk:rules': z.object({ topic: z.string().trim().min(1).max(60).optional(), left: z.string().trim().min(1).max(40).optional(), right: z.string().trim().min(1).max(40).optional(),
    roundSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(), mode: z.enum(['ray', 'amphi']).optional() }),
  'disk:join': z.object({}),
  'disk:start': z.object({ word: z.string().trim().min(1).max(40), target: z.number() }),
  'disk:guess': z.object({ value: z.number() }),
  'disk:next': z.object({}),
  'game:reset': z.object({}),
  'poll:settings': z.object({ seconds: z.union([z.literal(180), z.literal(300), z.literal(900), z.literal(1800), z.literal(3600), z.literal(10800)]).optional(), secret: z.boolean().optional() }),
  'poll:publish': z.object({ kind: z.enum(['choices', 'free', 'gradient']), question: z.string().trim().min(1).max(120), choices: z.array(z.string().trim().max(40)).max(8),
    pics: z.array(z.object({ mediaId: z.string().uuid().optional(), stickerId: z.string().uuid().optional(),
      gif: gifRef.optional() }).nullable()).max(8) }),
  'poll:answer': z.object({ answer: z.union([z.number().int().min(0).max(7), z.string().trim().min(1).max(60), z.tuple([z.number(), z.number()])]) }),
  'poll:end': z.object({}),
  'poll:chat-answer': z.object({ id: z.number().int().positive(), answer: z.union([z.number().int().min(0).max(7), z.string().trim().min(1).max(60), z.tuple([z.number(), z.number()])]) }),
  'poll:chat-end': z.object({ id: z.number().int().positive() }),
  'poll:next': z.object({}),
  'wheel:set': z.object({ items: z.array(z.object({ label: z.string().max(40), weight: z.string().max(8) })).max(12) }),
  'wheel:spin': z.object({}),
  'wheel:edit': z.object({}),
  'palmares:get': z.object({}),
  'web:set': z.object({ integration: z.enum(['lowtide']), url: z.url().max(300) }),
  'cards:deal': z.object({}),
  'cards:play': z.object({ cards: z.array(z.string().max(4)).min(1).max(4) }),
  'cards:pass': z.object({}),
  'tarot:bid': z.object({ bid: z.enum(['pass', 'prise', 'garde', 'sans', 'contre']) }),
  'tarot:call': z.object({ card: z.string().max(4) }),
  'tarot:discard': z.object({ cards: z.array(z.string().max(4)).max(6) }),
  'tarot:tricks': z.object({ show: z.boolean() }),
  'cards:bots': z.object({ level: z.enum(['facile', 'moyen', 'fort']) }),
  'holdem:act': z.object({ act: z.enum(['fold', 'check', 'call', 'raise', 'allin']), to: z.number().int().min(1).max(100_000_000).optional() }),
  'holdem:rules': z.object({ stack: z.number().int().refine(n => (HOLDEM_STACKS as readonly number[]).includes(n)).optional(), every: z.number().int().refine(n => (HOLDEM_EVERY as readonly number[]).includes(n)).optional() }),
  'holdem:end': z.object({}),
  'coinche:say': z.object({ kind: z.enum(['pass', 'bid', 'coinche', 'surcoinche']), value: z.number().int().min(80).max(250).optional(), suit: z.enum(['S', 'H', 'D', 'C']).optional() }),
  'coinche:target': z.object({ target: z.number().int().refine(n => (COINCHE_TARGETS as readonly number[]).includes(n)) }),
  'tarot:handful': z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  'tarot:chelem': z.object({}),
  'tarot:art': z.object({ card: z.number().int().min(0).max(21), mediaId: z.string().uuid().nullable() }),
  'tarot:art-reset': z.object({}),
  'effect:play': z.object({ kind: z.enum(EFFECTS), target: z.string().uuid().nullable().optional(),
    pic: z.object({ kind: z.enum(['image', 'sticker', 'gif', 'emoji']), value: z.string().min(1).max(700_000) }).optional() }),
  'cards:players': z.object({ game: z.enum(['tdc', 'tarot', 'holdem', 'coinche']), players: z.number().int().min(2).max(8) }),
  'table:join': z.object({}),
  'table:leave': z.object({}),
  'gif:favorites': z.object({ favorites: z.array(gifRef).max(200) }),
} as const;
export type IntentName = keyof typeof intents;
export type Intent<N extends IntentName> = z.infer<(typeof intents)[N]>;

/** Every acknowledgement: ok with a value, or an error said to this player only (French). */
export type Ack<T = null> = { ok: true; value: T } | { ok: false; error: string };

export interface IntentResults {
  'room:check': 'ok' | 'unknown';
  'room:join': RoomState;
  'room:leave': null;
  'chat:history': ChatPage;
  'chat:send': null;
  'chat:react': null;
  'profile:update': AccountView;
  'rooms:save': null;
  'account:find': { exists: boolean; retired: boolean; name: string | null; triesLeft?: number; retryIn?: number };   // retryIn: the next try waits (ms)
  'account:renew': null;
  'host:give': null;
  'media:ticket': { ticket: string; url: string };
  'chat:media': null;
  'chat:gif': null;
  'sticker:add': StickerView;   // the sticker (to show it in the preview before sending it)
  'sticker:send': null;
  'sticker:remove': null;
  'emoji:add': null;
  'photo:set': null;
  'gif:search': GifPage;
  'gif:trending': GifPage;
  'gif:favorites': null;
  'vote:cast': null;
  'host:ask': 'already' | 'taken' | 'vote';
  'activity:choose': 'applied' | 'vote';
  'credit:give': null;
  'kick:ask': 'vote';
  'disk:rules': 'now' | 'pending';
  'disk:join': null;
  'disk:start': null;
  'disk:guess': null;
  'disk:next': null;
  'game:reset': null;
  'poll:settings': null;
  'poll:publish': null;
  'poll:answer': null;
  'poll:end': null;
  'poll:chat-answer': null;
  'poll:chat-end': null;
  'poll:next': null;
  'wheel:set': null;
  'wheel:spin': null;
  'wheel:edit': null;
  'palmares:get': PalmaresEvent[];
  'web:set': null;
  'cards:deal': null;
  'cards:play': null;
  'cards:pass': null;
  'tarot:bid': null;
  'tarot:call': null;
  'tarot:discard': null;
  'tarot:tricks': null;
  'cards:bots': null;
  'holdem:act': null;
  'holdem:rules': null;
  'holdem:end': null;
  'coinche:say': null;
  'coinche:target': null;
  'tarot:handful': null;
  'tarot:chelem': null;
  'tarot:art': null;
  'tarot:art-reset': null;
  'effect:play': null;
  'cards:players': null;
  'table:join': 'ok' | 'full';
  'table:leave': null;
}

/** GIF results: the provider that answered, or why there is none (no key, key refused, no answer). */
export interface GifPage { items: GifRef[]; next: number | null; provider: string | null; error: 'no-key' | 'refused' | 'down' | null }

/** What an upload answers (POST /api/media). */
export type UploadResult = Ack<{ id: string; url: string; w: number; h: number }>;

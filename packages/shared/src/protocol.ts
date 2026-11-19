// The WebSocket protocol (Socket.IO) between the panel and the server (openspec: realtime-sync). The client sends
// intents, validated here with zod on the server; the server answers by acknowledgements and sends the room's full
// state, then numbered events. A client that sees a gap in the numbers asks for the full state again.
import { z } from 'zod';

// ------------------------------------------------------------------ handshake
/** Sent in Socket.IO's `auth` (never in the address). */
export const handshakeSchema = z.object({ code: z.string().min(1).max(64), protocol: z.number().int() });
export type Handshake = z.infer<typeof handshakeSchema>;

/** Why the server refuses or ends a connection (the panel shows the French text it maps to). */
export type FatalReason = 'protocol' | 'code' | 'retired' | 'limited' | 'replaced';

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
  score: number;
  credit: number;
  joinedAt: number;
}

/** A quoted message: what a reply shows above itself; `gone` once the quoted one is deleted (30 days). */
export interface Quote { id: number; from: string | null; text: string; kind: string; gone: boolean }
export interface MessageView {
  id: number;
  from: string | null;             // null: the room (system)
  kind: 'text' | 'system' | 'media' | 'vote' | 'credit';
  text: string;
  at: number;
  reply: Quote | null;
  reactions: Record<string, string[]>;
  media?: MediaView | null;
  preview?: LinkPreview | null;    // the first link's preview, read by the server (arrives after the message)
  data?: Record<string, unknown> | null;
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
  disk: DiskView;
  poll: PollView;
  wheel: WheelView;
  cards: CardsView;
  web: Record<string, string>;   // each integration's address, checked by the host (default: its own)
  serverTime: number;
}

/** What the server says right after a connection is accepted. */
export interface Hello { account: AccountView; protocol: number; serverTime: number; insecure: boolean }

export type RoomEvent =
  | { type: 'message'; message: MessageView }
  | { type: 'message-removed'; id: number }
  | { type: 'reactions'; id: number; reactions: Record<string, string[]> }
  | { type: 'member'; member: MemberView }
  | { type: 'host'; hostId: string | null }
  | { type: 'message-updated'; message: MessageView }
  | { type: 'stickers'; stickers: StickerView[] }
  | { type: 'emoji'; emoji: EmojiView[] }
  | { type: 'activity'; activity: ActivityChoice }
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
  result: { taker: string; partner: string | null; bid: string; bouts: number; need: number; made: number; won: boolean; score: number; marks: Record<string, number> } | null; note: string;
}
export interface CardsView {
  game: 'tdc' | 'tarot';
  players: 4 | 5;                        // Tarot: at 4 or 5
  showTricks: boolean;                   // Tarot: the won tricks can be looked at
  seats: CardSeatView[];
  tdc: TdcRoundView | null;
  tarot: TarotDealView | null;
  paid: Record<string, string | null>;   // the last round: who got each seat's points (null: a robot)
  turnSince: number;
  late: { seat: string; user: string; secs: number } | null;   // a player's turn has lasted 30 s: /kick possible
}
export const READY_CARD_GAMES = ['tdc', 'tarot'];
/** One player's result in one round (the Palmarès, kept with the room). */
export interface PalmaresEvent { at: number; game: 'disk' | 'tdc' | 'tarot'; id: string; name: string; hue: number; won: boolean; pts?: number; perfect?: boolean; role?: string; taker?: boolean; partner?: boolean }

export type PollAnswer = number | string | [number, number];
export interface PollPicView { kind: 'image' | 'sticker' | 'gif'; src: string; w: number; h: number }
/** The Sondage as a player sees it: during the poll, only who answered and my own answer; then everything (names
 *  hidden when secret). */
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
export interface WheelView { phase: 'writing' | 'spinning' | 'result'; items: WheelItemView[]; spin: SpinView | null; needle: number }
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
  'room:join': z.object({ key: z.string().max(16) }),
  'room:leave': z.object({}),
  'chat:history': z.object({ before: z.number().int().positive() }),
  'chat:send': z.object({ text: z.string().trim().min(1).max(MAX_TEXT), replyTo: z.number().int().positive().nullable().optional() }),
  'chat:react': z.object({ id: z.number().int().positive(), emoji: z.string().min(1).max(64) }),
  'profile:update': z.object({ name: z.string().trim().max(20).optional(), hue: z.number().int().min(0).max(359).nullable().optional(), quick: z.string().max(32).nullable().optional() }),
  'rooms:save': z.object({ rooms: z.array(z.object({ key: z.string().max(16), name: z.string().max(40), pending: z.boolean() })).max(100) }),
  'account:find': z.object({ code: z.string().max(64) }),
  'account:renew': z.object({ code: z.string().max(64) }),
  'host:give': z.object({ to: z.string().uuid() }),
  'media:ticket': z.object({ usage: z.enum(['chat', 'sticker', 'emoji', 'photo', 'poll', 'trump']) }),
  'chat:media': z.object({ mediaId: z.string().uuid(), replyTo: z.number().int().positive().nullable().optional() }),
  'chat:gif': z.object({ gif: z.object({ id: z.string().max(64), provider: z.string().max(16), url: z.url(), w: z.number().int(), h: z.number().int(), title: z.string().max(200) }) }),
  'sticker:add': z.object({ mediaId: z.string().uuid(), send: z.boolean() }),
  'sticker:send': z.object({ id: z.string().uuid() }),
  'sticker:remove': z.object({ id: z.string().uuid() }),
  'emoji:add': z.object({ name: z.string().regex(/^[a-z0-9_]{2,24}$/), mediaId: z.string().uuid() }),
  'photo:set': z.object({ mediaId: z.string().uuid().nullable() }),
  'gif:search': z.object({ q: z.string().trim().min(1).max(60), page: z.number().int().min(0).max(20), provider: z.string().max(16).nullable().optional() }),
  'gif:trending': z.object({ page: z.number().int().min(0).max(20), provider: z.string().max(16).nullable().optional() }),
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
  'disk:reset': z.object({}),
  'poll:settings': z.object({ seconds: z.union([z.literal(180), z.literal(300), z.literal(900), z.literal(1800), z.literal(3600), z.literal(10800)]).optional(), secret: z.boolean().optional() }),
  'poll:publish': z.object({ kind: z.enum(['choices', 'free', 'gradient']), question: z.string().trim().min(1).max(120), choices: z.array(z.string().trim().max(40)).max(8),
    pics: z.array(z.object({ mediaId: z.string().uuid().optional(), stickerId: z.string().uuid().optional() }).nullable()).max(8) }),
  'poll:answer': z.object({ answer: z.union([z.number().int().min(0).max(7), z.string().trim().min(1).max(60), z.tuple([z.number(), z.number()])]) }),
  'poll:end': z.object({}),
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
  'table:join': z.object({}),
  'table:leave': z.object({}),
  'gif:favorites': z.object({ favorites: z.array(z.object({ id: z.string().max(64), provider: z.string().max(16), url: z.url(), w: z.number().int(), h: z.number().int(), title: z.string().max(200) })).max(200) }),
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
  'account:find': { exists: boolean; retired: boolean; name: string | null };
  'account:renew': null;
  'host:give': null;
  'media:ticket': { ticket: string; url: string };
  'chat:media': null;
  'chat:gif': null;
  'sticker:add': null;
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
  'disk:reset': null;
  'poll:settings': null;
  'poll:publish': null;
  'poll:answer': null;
  'poll:end': null;
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
  'table:join': 'ok' | 'full';
  'table:leave': null;
}

/** GIF results: the provider that answered, or why there is none (no key, key refused, no answer). */
export interface GifPage { items: GifRef[]; next: number | null; provider: string | null; error: 'no-key' | 'refused' | 'down' | null }

/** What an upload answers (POST /api/media). */
export type UploadResult = Ack<{ id: string; url: string; w: number; h: number }>;

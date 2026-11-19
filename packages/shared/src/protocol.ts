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
  media?: { kind: 'image' | 'sticker' | 'gif'; src: string | null; w: number; h: number } | null;   // src null: gone
  data?: Record<string, unknown> | null;
}
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
  serverTime: number;
}

/** What the server says right after a connection is accepted. */
export interface Hello { account: AccountView; protocol: number; serverTime: number; insecure: boolean }

export type RoomEvent =
  | { type: 'message'; message: MessageView }
  | { type: 'message-removed'; id: number }
  | { type: 'reactions'; id: number; reactions: Record<string, string[]> }
  | { type: 'member'; member: MemberView }
  | { type: 'host'; hostId: string | null };
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
}

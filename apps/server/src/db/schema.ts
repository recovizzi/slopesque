// The database (openspec: plan-slopesque-v1, design decision 5). Everything of a room goes with it (ON DELETE CASCADE);
// only accounts live outside rooms. Pictures are rows of `media`; a row that points to a picture gone either loses it
// (a chat message: « Image plus disponible ») or goes with it (a sticker, an emoji, a trump's picture).
import { sql } from 'drizzle-orm';
import { bigserial, bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

/** A player: found by the HMAC of his code (never the code). */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  codeHmac: text('code_hmac').notNull().unique(),
  name: text('name').notNull().default(''),
  hue: integer('hue'),
  quick: text('quick'),
  rooms: jsonb('rooms').$type<{ key: string; name: string; pending: boolean }[]>().notNull().default([]),
  gifFavorites: jsonb('gif_favorites').$type<unknown[]>().notNull().default([]),
  createdAt: at('created_at'),
  lastSeenAt: at('last_seen_at'),
});

/** Past pseudos, for the admin's search (accounts:find). */
export const accountNames = pgTable('account_names', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  at: at('at'),
}, t => [index('account_names_account').on(t.accountId), index('account_names_name').on(t.name)]);

/** Codes replaced (renewed, or reset by an admin): refused for ever, never given again. */
export const retiredCodes = pgTable('retired_codes', {
  codeHmac: text('code_hmac').primaryKey(),
  retiredAt: at('retired_at'),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  name: text('name').notNull().default(''),
  hostId: uuid('host_id').references(() => accounts.id, { onDelete: 'set null' }),
  rules: jsonb('rules').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: at('created_at'),
  lastActivityAt: at('last_activity_at'),
});

/** A stored picture: one per (usage, sha256) — the same file sent again is the same picture (media-storage). */
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  usage: text('usage').notNull(),          // emoji, sticker, photo, chat, poll, trump, preview
  sha256: text('sha256').notNull(),
  bucket: text('bucket').notNull(),
  objectKey: text('object_key').notNull(),
  mime: text('mime').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: at('created_at'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),   // chat images: 7 days after the last sending
}, t => [uniqueIndex('media_usage_sha').on(t.usage, t.sha256)]);

/** A player in a room: what is his there (scores, credit, photo…). */
export const roomMembers = pgTable('room_members', {
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  hue: integer('hue').notNull(),
  scores: jsonb('scores').$type<Record<string, number>>().notNull().default({}),   // the ranking of each game (disk, tdc, tarot), reset one by one
  credit: integer('credit').notNull().default(0),
  photoId: uuid('photo_id').references(() => media.id, { onDelete: 'set null' }),
  playing: boolean('playing').notNull().default(false),
  joinedAt: at('joined_at'),
  lastSeenAt: at('last_seen_at'),
}, t => [primaryKey({ columns: [t.roomId, t.accountId] })]);

/** The chat (30 days). kind: text, system, media, vote, credit; `data` holds a vote's or a credit change's details. */
export const messages = pgTable('messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => accounts.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  text: text('text').notNull().default(''),
  mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
  mediaKind: text('media_kind'),            // what the picture was (image, sticker, gif), kept when it is gone
  gif: jsonb('gif').$type<Record<string, unknown>>(),   // a GIF: a link to the provider, not stored
  replyTo: bigint('reply_to', { mode: 'number' }),      // no foreign key: the quoted message may be gone (30 days)
  data: jsonb('data').$type<Record<string, unknown>>(),
  scope: text('scope'),                     // a game's system line: the activity's session (« cards#12 »), shown only during it
  createdAt: at('created_at'),
}, t => [index('messages_room').on(t.roomId, t.id), index('messages_created').on(t.createdAt)]);

export const reactions = pgTable('reactions', {
  messageId: bigint('message_id', { mode: 'number' }).notNull().references(() => messages.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  at: at('at'),
}, t => [primaryKey({ columns: [t.messageId, t.accountId, t.emoji] })]);

/** The room's sticker library: removed, or its picture gone → the sticker goes. */
export const stickers = pgTable('stickers', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  addedBy: uuid('added_by').references(() => accounts.id, { onDelete: 'set null' }),
  usedAt: at('used_at'),
}, t => [index('stickers_room').on(t.roomId)]);

export const customEmoji = pgTable('custom_emoji', {
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  addedBy: uuid('added_by').references(() => accounts.id, { onDelete: 'set null' }),
  createdAt: at('created_at'),
}, t => [primaryKey({ columns: [t.roomId, t.name] })]);

/** Tarot: the host's pictures for the trumps ('0' the Excuse … '21'), for the room. */
export const trumpArt = pgTable('trump_art', {
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  card: text('card').notNull(),
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
}, t => [primaryKey({ columns: [t.roomId, t.card] })]);

/** The Palmarès: every result, kept with the room (a reset of the scores doesn't touch it). */
export const palmares = pgTable('palmares', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  game: text('game').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  at: at('at'),
}, t => [index('palmares_room').on(t.roomId, t.game)]);

/** What the admin did from the console (never a user code). */
export const adminLog = pgTable('admin_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: at('at'),
  command: text('command').notNull(),
  target: text('target'),
  details: jsonb('details').$type<Record<string, unknown>>(),
});

export const now = sql`now()`;

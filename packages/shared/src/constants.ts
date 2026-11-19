// Values shared by the server, the app and the extension. Durations in milliseconds unless said otherwise.

/** The WebSocket protocol's version: a client with another one is asked to update the extension. */
export const PROTOCOL_VERSION = 1;

/** Room keys and drawn user codes: no I, L, O, 0 or 1 (they look alike). */
export const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // gitleaks:allow (an alphabet, not a key)

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** What is kept, and how long (openspec: data-retention). */
export const RETENTION = {
  messages: 30 * DAY,
  chatImages: 7 * DAY,
  linkPreviews: 7 * DAY,
  gifSearch: HOUR,
  gifTrending: 15 * MINUTE,
  failedLookup: 5 * MINUTE,
} as const;

/** Presence (openspec: realtime-sync, game-session). */
export const PRESENCE = {
  graceMs: 15_000,          // no connection for this long: away
  goneMs: 5 * MINUTE,       // away this long: /hote without a vote
  hiddenTabMs: 30_000,      // a hidden tab disconnects after this
} as const;

/** Sending limits per account (openspec: realtime-sync). */
export const LIMITS = {
  messages: { count: 10, perMs: 10_000 },
  reactions: { count: 20, perMs: 10_000 },
  uploads: { count: 10, perMs: MINUTE },
  codeAttempts: { count: 10, perMs: MINUTE },   // unknown codes, per IP
  maxUploadBytes: 15 * 1024 * 1024,
  chatPage: 100,
} as const;

/** Storage room (openspec: data-retention, Place disponible). */
export const STORAGE = { warnRatio: 0.9, refuseRatio: 0.98 } as const;

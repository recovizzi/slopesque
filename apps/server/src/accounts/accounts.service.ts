// Accounts (openspec: player-account). Found by the HMAC of the code (with the server's secret), never the code itself;
// the first unknown code makes an empty account; a replaced code is retired for ever. Unknown codes are limited per IP.
import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { canonicalCode, codeStrength, CODE_MIN_LEN } from '@slopesque/engines';
import { KEY_ALPHABET, LIMITS, type AccountView, type FatalReason, type SavedRoom } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { DB, type Db } from '../db/db.module.js';
import { accountNames, accounts, adminLog, retiredCodes, roomMembers } from '../db/schema.js';
import { CacheService } from '../cache/cache.service.js';
import { UserError } from '../errors.js';

export type Account = typeof accounts.$inferSelect;

/** « 4 min 32 s ». */
const wait = (ms: number) => { const s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return m ? `${m} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`; };

@Injectable()
export class AccountsService {
  /** Without Redis (« Reprendre un compte »): an address waits 3 min after each unknown code — still protected, never shared. */
  private readonly slow = new Map<string, number>();

  constructor(@Inject(ENV) private readonly env: Env, @Inject(DB) private readonly db: Db, private readonly cache: CacheService) {}

  hmac(code: string) { return createHmac('sha256', this.env.CODE_HMAC_SECRET).update(canonicalCode(code)).digest('hex'); }

  private async isRetired(h: string) { return !!(await this.db.query.retiredCodes.findFirst({ where: eq(retiredCodes.codeHmac, h) })); }

  /** A connection's code → its account (made if new), or why not. */
  async authenticate(code: string, ip: string): Promise<{ account: Account } | { reason: FatalReason }> {
    if (canonicalCode(code).length < CODE_MIN_LEN) return { reason: 'code' };
    const h = this.hmac(code);
    const found = await this.db.query.accounts.findFirst({ where: eq(accounts.codeHmac, h) });
    if (found) {
      await this.db.update(accounts).set({ lastSeenAt: new Date() }).where(eq(accounts.id, found.id));
      return { account: found };
    }
    if (await this.isRetired(h)) return { reason: 'retired' };
    if (!(await this.cache.allow(`code:${ip}`, this.env.CODE_ATTEMPTS_PER_MINUTE, LIMITS.codeAttempts.perMs))) return { reason: 'limited' };
    const name = `Joueur ${[...crypto.getRandomValues(new Uint32Array(3))].map(v => KEY_ALPHABET[v % KEY_ALPHABET.length]).join('')}`;
    const [account] = await this.db.insert(accounts).values({ codeHmac: h, name }).onConflictDoNothing().returning();
    return account ? { account } : this.authenticate(code, ip);   // made at the same moment by another connection
  }

  async get(id: string) { return (await this.db.query.accounts.findFirst({ where: eq(accounts.id, id) }))!; }

  view(a: Account): AccountView { return { id: a.id, name: a.name, hue: a.hue, quick: a.quick, rooms: a.rooms, gifFavorites: a.gifFavorites as AccountView['gifFavorites'] }; }

  /** « Reprendre un compte » / « Repartir de zéro »: does an account have this code (limited like unknown codes)? Taking an
   *  account back (resume): 3 wrong codes from an address, then 5 min to wait — even a right code waits. */
  async find(code: string, ip: string, resume = false) {
    const key = `code-resume:${ip}`, now = Date.now();
    if (resume && this.cache.state !== 'ok') return this.findSlowly(code, ip, now);
    const fails = resume ? (await this.cache.get<{ n: number; until: number }>(key)) ?? { n: 0, until: 0 } : null;
    if (fails && fails.until > now) throw new UserError(`Trois codes inconnus : réessaie dans ${wait(fails.until - now)}.`);
    if (!(await this.cache.allow(`code:${ip}`, this.env.CODE_ATTEMPTS_PER_MINUTE, LIMITS.codeAttempts.perMs))) throw new UserError('Trop d\'essais : attends une minute.');
    const h = this.hmac(code);
    const a = await this.db.query.accounts.findFirst({ where: eq(accounts.codeHmac, h) });
    const found = { exists: !!a, retired: !a && (await this.isRetired(h)), name: a?.name ?? null };
    if (!fails) return found;
    if (a) { await this.cache.set(key, { n: 0, until: 0 }, 1000); return found; }   // the right code: counted from zero again
    const n = fails.n + 1, { tries, lockMs } = LIMITS.codeResume;
    if (n >= tries) {
      await this.cache.set(key, { n: 0, until: now + lockMs }, lockMs);
      throw new UserError(`Trois codes inconnus : réessaie dans ${wait(lockMs)}.`);
    }
    await this.cache.set(key, { n, until: 0 }, lockMs);
    return { ...found, triesLeft: tries - n };
  }

  /** Without Redis: each unknown code makes the address wait 3 min (LIMITS.codeResumeAlone), the right one never does. */
  private async findSlowly(code: string, ip: string, now: number) {
    const until = this.slow.get(ip) ?? 0;
    if (until > now) throw new UserError(`Code inconnu : réessaie dans ${wait(until - now)}.`);
    for (const [k, v] of this.slow) if (v < now) this.slow.delete(k);   // the old ones go
    const h = this.hmac(code), a = await this.db.query.accounts.findFirst({ where: eq(accounts.codeHmac, h) });
    const found = { exists: !!a, retired: !a && (await this.isRetired(h)), name: a?.name ?? null };
    if (!a) { this.slow.set(ip, now + LIMITS.codeResumeAlone); return { ...found, retryIn: LIMITS.codeResumeAlone }; }
    return found;
  }

  /** « Renouveler mon code »: the same account under a new code; the old one retired. */
  async renew(id: string, code: string) {
    if (codeStrength(code).level < 2) throw new UserError(codeStrength(code).reason);
    const h = this.hmac(code), me = await this.get(id);
    if (h === me.codeHmac) throw new UserError('C\'est déjà ton code.');
    if (await this.isRetired(h) || await this.db.query.accounts.findFirst({ where: eq(accounts.codeHmac, h) })) throw new UserError('Ce code est déjà pris : choisis-en un autre.');
    await this.db.transaction(async tx => {
      await tx.insert(retiredCodes).values({ codeHmac: me.codeHmac }).onConflictDoNothing();
      await tx.update(accounts).set({ codeHmac: h }).where(eq(accounts.id, id));
      await tx.insert(adminLog).values({ command: 'account:renew', target: id });   // to follow a problem later (never a code)
    });
  }

  /** Admin: a random code for an account, shown once; the old one retired. */
  async resetCode(id: string, code: string) {
    const me = await this.get(id);
    await this.db.transaction(async tx => {
      await tx.insert(retiredCodes).values({ codeHmac: me.codeHmac }).onConflictDoNothing();
      await tx.update(accounts).set({ codeHmac: this.hmac(code) }).where(eq(accounts.id, id));
    });
  }

  async updateProfile(id: string, p: { name?: string; hue?: number | null; quick?: string | null }) {
    const me = await this.get(id), changes: Partial<Account> = {};
    if (p.name !== undefined && p.name && p.name !== me.name) {
      changes.name = p.name;
      await this.db.insert(accountNames).values({ accountId: id, name: me.name });   // the past pseudo, for accounts:find
    }
    if (p.hue !== undefined) changes.hue = p.hue;
    if (p.hue !== undefined && p.hue !== null) await this.db.update(roomMembers).set({ hue: p.hue }).where(eq(roomMembers.accountId, id));   // my colour in every room
    if (p.quick !== undefined) changes.quick = p.quick;
    if (Object.keys(changes).length) await this.db.update(accounts).set(changes).where(eq(accounts.id, id));
    return this.get(id);
  }

  async saveRooms(id: string, rooms: SavedRoom[]) { await this.db.update(accounts).set({ rooms }).where(eq(accounts.id, id)); }

  /** Admin: accounts by pseudo (current or past), room, last connection; never a code. */
  async search(o: { name?: string; roomKey?: string; seenAfter?: Date }) {
    return this.db.execute<{ id: string; name: string; past: string | null; rooms: string | null; created_at: string; last_seen_at: string }>(sql`
      select a.id, a.name, a.created_at, a.last_seen_at,
        (select string_agg(distinct n.name, ', ') from account_names n where n.account_id = a.id) as past,
        (select string_agg(r.key, ', ') from room_members m join rooms r on r.id = m.room_id where m.account_id = a.id) as rooms
      from accounts a
      where (${o.name ?? null}::text is null or a.name ilike '%' || ${o.name ?? null} || '%'
             or exists (select 1 from account_names n where n.account_id = a.id and n.name ilike '%' || ${o.name ?? null} || '%'))
        and (${o.roomKey ?? null}::text is null or exists (select 1 from room_members m join rooms r on r.id = m.room_id where m.account_id = a.id and r.key = ${o.roomKey ?? null}))
        and (${o.seenAfter?.toISOString() ?? null}::timestamptz is null or a.last_seen_at >= ${o.seenAfter?.toISOString() ?? null})
      order by a.last_seen_at desc limit 50`);
  }
}

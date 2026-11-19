// The admin's console (openspec: admin-console): `pnpm admin <commande>` in development, `admin <commande>` in the
// production container. No HTTP route, no panel. Destructive commands ask for confirmation (or --yes); every command
// is written in admin_log, never with a user code. The running server hears the changes (LISTEN/NOTIFY).
import 'reflect-metadata';
import { createInterface } from 'node:readline/promises';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { newCode, normalizeKey } from '@slopesque/engines';
import { CoreModule } from './app.module.js';
import { DB, type Db } from './db/db.module.js';
import { accounts, adminLog, customEmoji, media, messages, roomMembers, stickers, trumpArt } from './db/schema.js';
import { and, sql } from 'drizzle-orm';
import { MediaService } from './media/media.service.js';
import { AccountsService } from './accounts/accounts.service.js';
import { RoomsService } from './rooms/rooms.service.js';
import { ChatService } from './chat/chat.service.js';
import { CacheService } from './cache/cache.service.js';
import { StorageService } from './storage/storage.service.js';
import { UserError } from './errors.js';

const HELP: Record<string, [string, string]> = {
  'rooms:create': ['[--key XXXX-XXXX] [--name …]', 'crée un salon (clé tirée au hasard si absente) et affiche sa clé'],
  'rooms:list': ['[--search …]', 'les salons : joueurs, dernière activité'],
  'rooms:delete': ['<clé> [--yes]', 'supprime le salon et tout ce qu\'il contient (définitif : aucune sauvegarde)'],
  'accounts:find': ['[--name …] [--room XXXX-XXXX] [--seen-after AAAA-MM-JJ]', 'comptes correspondants (uuid, pseudos, salons, dates), jamais de code'],
  'accounts:show': ['<uuid>', 'le détail d\'un compte'],
  'accounts:reset-code': ['<uuid> [--yes]', 'donne au compte un code tiré au hasard, affiché une seule fois ; l\'ancien est retiré'],
  'credit:reset': ['<clé> [--account <uuid>] [--yes]', 'remet à zéro le crédit social d\'un joueur, ou de tout le salon'],
  'messages:delete': ['<id> [--yes]', 'retire un message (modération) : « Message retiré par un admin »'],
  'media:delete': ['<id> [--yes]', 'retire une image, un sticker ou un emoji (modération), partout où il sert'],
  'media:stats': ['', 'place occupée par usage, images du chat qui expirent dans les 24 h'],
  'purge:run': ['', 'lance la purge planifiée tout de suite (messages de plus de 30 jours, images expirées)'],
  'services:check': ['', 'état de Postgres, Redis, RustFS, des clés externes et de la place'],
};

const [command, ...rest] = process.argv.slice(2);
const flags: Record<string, string | true> = {}, args: string[] = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i]!;
  if (a.startsWith('--')) { const next = rest[i + 1]; if (next && !next.startsWith('--') && a !== '--yes') { flags[a.slice(2)] = next; i++; } else flags[a.slice(2)] = true; }
  else args.push(a);
}
const str = (k: string) => (typeof flags[k] === 'string' ? flags[k] as string : undefined);

if (!command || command === 'help' || flags.help || !HELP[command]) {
  if (command && command !== 'help' && !HELP[command]) console.error(`Commande inconnue : ${command}\n`);
  console.log(`Usage : admin <commande> [options]\n\n${Object.entries(HELP).map(([c, [a, d]]) => `  ${c} ${a}\n      ${d}`).join('\n')}`);
  process.exit(command && command !== 'help' && !flags.help ? 1 : 0);
}

async function confirm(question: string) {
  if (flags.yes) return true;
  if (!process.stdin.isTTY) { console.error('Confirmation impossible sans terminal : ajoute --yes.'); return false; }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} Taper « oui » pour confirmer : `)).trim().toLowerCase();
  rl.close();
  return answer === 'oui';
}

Logger.overrideLogger(['error']);
const app = await NestFactory.createApplicationContext(CoreModule, { logger: ['error'] });
const db = app.get<Db>(DB), rooms = app.get(RoomsService), accts = app.get(AccountsService);
const log = (target: string | null, details?: Record<string, unknown>) => db.insert(adminLog).values({ command, target, details });
const date = (d: string | Date) => new Date(d).toLocaleString('fr-FR');
let code = 0;

try {
  switch (command) {
    case 'rooms:create': {
      const r = await rooms.create(str('key'), str('name') ?? '');
      await log(r.key, { name: r.name });
      console.log(`Salon créé : ${r.key}${r.name ? ` (${r.name})` : ''}`);
      break;
    }
    case 'rooms:list': {
      const list = await rooms.list(str('search'));
      if (!list.length) console.log('Aucun salon.');
      for (const r of list) console.log(`${r.key}  ${String(r.players).padStart(3)} joueur(s)  activité ${date(r.last_activity_at)}  ${r.name}`);
      break;
    }
    case 'rooms:delete': {
      const key = normalizeKey(args[0] ?? '');
      const room = key ? await rooms.byKey(key) : null;
      if (!room) throw new UserError('Aucun salon avec cette clé.');
      if (!(await confirm(`Supprimer ${room.key}${room.name ? ` (${room.name})` : ''} et tout son contenu ? Suppression définitive : aucune sauvegarde.`))) { console.log('Annulé.'); break; }
      await rooms.delete(room.key);
      await log(room.key);
      console.log(`Salon ${room.key} supprimé.`);
      break;
    }
    case 'accounts:find': {
      const seen = str('seen-after');
      const list = await accts.search({ name: str('name'), roomKey: str('room') ? normalizeKey(str('room')!) ?? str('room') : undefined, seenAfter: seen ? new Date(seen) : undefined });
      if (!list.length) console.log('Aucun compte ne correspond.');
      for (const a of list) console.log(`${a.id}  ${a.name}${a.past ? ` (avant : ${a.past})` : ''}\n    salons : ${a.rooms ?? '—'} · créé ${date(a.created_at)} · vu ${date(a.last_seen_at)}`);
      await log(null, { name: str('name'), room: str('room'), seenAfter: seen });
      break;
    }
    case 'accounts:show': {
      const a = args[0] ? await db.query.accounts.findFirst({ where: eq(accounts.id, args[0]) }).catch(() => undefined) : undefined;
      if (!a) throw new UserError('Aucun compte avec cet uuid.');
      console.log(`${a.id}\n  pseudo : ${a.name}\n  couleur : ${a.hue ?? 'par défaut'}\n  salons enregistrés : ${a.rooms.map(r => r.key).join(', ') || '—'}\n  créé : ${date(a.createdAt)}\n  vu : ${date(a.lastSeenAt)}`);
      break;
    }
    case 'accounts:reset-code': {
      const a = args[0] ? await db.query.accounts.findFirst({ where: eq(accounts.id, args[0]) }).catch(() => undefined) : undefined;
      if (!a) throw new UserError('Aucun compte avec cet uuid.');
      if (!(await confirm(`Donner un nouveau code au compte ${a.name} (${a.id}) ? L'ancien ne marchera plus.`))) { console.log('Annulé.'); break; }
      const fresh = newCode();
      await accts.resetCode(a.id, fresh);
      await rooms.notify({ type: 'code-reset', accountId: a.id });
      await log(a.id);
      console.log(`Nouveau code de ${a.name} (affiché une seule fois, à transmettre) :\n\n    ${fresh}\n`);
      break;
    }
    case 'credit:reset': {
      const room = await rooms.byKey(args[0] ?? '');
      if (!room) throw new UserError('Aucun salon avec cette clé.');
      const who = str('account');
      if (!(await confirm(`Remettre à zéro le crédit social ${who ? `du compte ${who}` : 'de tout le salon'} ${room.key} ?`))) { console.log('Annulé.'); break; }
      const done = await db.update(roomMembers).set({ credit: 0 }).where(and(eq(roomMembers.roomId, room.id), who ? eq(roomMembers.accountId, who) : undefined)).returning();
      await rooms.notify({ type: 'members-changed', roomId: room.id });
      await log(room.key, { account: who ?? null, players: done.length });
      console.log(`Crédit social remis à zéro : ${done.length} joueur(s).`);
      break;
    }
    case 'messages:delete': {
      const id = Number(args[0]);
      const [m] = Number.isInteger(id) ? await db.select().from(messages).where(eq(messages.id, id)) : [];
      if (!m) throw new UserError('Aucun message avec cet identifiant.');
      console.log(`« ${m.text.slice(0, 120)}${m.mediaKind ? ` [${m.mediaKind}]` : ''} »`);
      if (!(await confirm('Retirer ce message ?'))) { console.log('Annulé.'); break; }
      await db.update(messages).set({ kind: 'system', text: 'Message retiré par un admin.', authorId: null, mediaId: null, mediaKind: null, gif: null, data: null }).where(eq(messages.id, id));
      await rooms.notify({ type: 'members-changed', roomId: m.roomId });
      await log(String(id));
      console.log('Message retiré.');
      break;
    }
    case 'media:delete': {
      const row = await app.get(MediaService).get(args[0] ?? '');
      if (!row) throw new UserError('Aucune image avec cet identifiant.');
      if (!(await confirm(`Retirer cette image (${row.usage}, ${row.width} × ${row.height}) partout où elle sert ?`))) { console.log('Annulé.'); break; }
      const affected = (await db.execute<{ room_id: string }>(sql`select distinct room_id from stickers where media_id = ${row.id} union select distinct room_id from custom_emoji where media_id = ${row.id}
        union select distinct room_id from room_members where photo_id = ${row.id} union select distinct room_id from trump_art where media_id = ${row.id} union select distinct room_id from messages where media_id = ${row.id}`)).map(r => r.room_id);
      await db.delete(stickers).where(eq(stickers.mediaId, row.id));
      await db.delete(customEmoji).where(eq(customEmoji.mediaId, row.id));
      await db.delete(trumpArt).where(eq(trumpArt.mediaId, row.id));
      await db.update(roomMembers).set({ photoId: null }).where(eq(roomMembers.photoId, row.id));
      await db.update(media).set({ expiresAt: new Date(0), usage: 'chat' }).where(eq(media.id, row.id));
      await app.get(MediaService).sweep([row.id]);
      for (const roomId of affected) await rooms.notify({ type: 'members-changed', roomId });
      await log(row.id, { usage: row.usage });
      console.log('Image retirée.');
      break;
    }
    case 'media:stats': {
      const rows = await db.execute<{ usage: string; n: number; bytes: string; soon: number }>(sql`select usage, count(*)::int as n, sum(bytes)::text as bytes,
        count(*) filter (where expires_at < now() + interval '24 hours')::int as soon from media group by usage order by usage`);
      const u = await app.get(StorageService).usage();
      for (const r of rows) console.log(`${r.usage.padEnd(8)} ${String(r.n).padStart(6)} fichier(s)  ${(Number(r.bytes) / 1024 / 1024).toFixed(1).padStart(8)} Mo${r.soon ? `  (${r.soon} expirent dans les 24 h)` : ''}`);
      console.log(`Total (Postgres + images) : ${(u.usedBytes / 1024 ** 3).toFixed(2)} Go sur ${(u.quotaBytes / 1024 ** 3).toFixed(0)} Go (${(u.ratio * 100).toFixed(1)} %). Sauvegardes : aucune.`);
      break;
    }
    case 'purge:run': {
      const n = await app.get(ChatService).purge(), pics = await app.get(MediaService).sweep();
      await log(null, { messages: n, pictures: pics });
      console.log(`Purge : ${n} message(s), ${pics} image(s) supprimé(s).`);
      break;
    }
    case 'services:check': {
      const cache = app.get(CacheService), storage = app.get(StorageService);
      await cache.onModuleInit();
      const s3 = await storage.check(), u = await storage.usage();
      console.log(`Postgres : ok\nRedis : ${cache.state}\nRustFS : ${s3}\nGIF : ${process.env.KLIPY_API_KEY || process.env.GIPHY_API_KEY ? 'configurés' : 'aucune clé'}\nPlace : ${(u.ratio * 100).toFixed(1)} % de ${(u.quotaBytes / 1024 ** 3).toFixed(0)} Go\nSauvegardes : aucune`);
      break;
    }
  }
} catch (e) {
  code = 1;
  console.error(e instanceof UserError ? e.message : `Erreur : ${(e as Error).message}`);
}
await app.close();
process.exit(code);

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
import { accounts, adminLog } from './db/schema.js';
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
  'purge:run': ['', 'lance la purge planifiée tout de suite (messages de plus de 30 jours)'],
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
    case 'purge:run': {
      const n = await app.get(ChatService).purge();
      await log(null, { messages: n });
      console.log(`Purge : ${n} message(s) supprimé(s).`);
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

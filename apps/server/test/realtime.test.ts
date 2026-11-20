// Black-box test of the built server (dist/): two players in a room made by the admin console, over Socket.IO.
// Needs the development services (`pnpm services:up`); skipped with a message when Postgres can't be reached.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type RoomState, type SequencedEvent } from '@slopesque/shared';

const PORT = 23199, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000' };
let server: ChildProcess;

const admin = (...args: string[]) => execFileSync(process.execPath, ['dist/admin.js', ...args], { env, encoding: 'utf8' });
const connect = (code: string, protocol = PROTOCOL_VERSION, version: string | null = '0.1.0') => io(URL, { auth: { code, protocol, ...(version ? { version } : {}) }, transports: ['websocket'], reconnection: false, forceNew: true });
const once = <T>(s: Socket, ev: string) => new Promise<T>(res => s.once(ev, res));
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const nextEvent = (s: Socket, type: string) => new Promise<SequencedEvent>(res => { const f = (e: SequencedEvent) => { if (e.type === type) { s.off('event', f); res(e); } }; s.on('event', f); });

describe.skipIf(!up)('realtime', () => {
  let key = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    key = admin('rooms:create', '--name', 'test').match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
  }, 20_000);
  afterAll(() => { server?.kill(); });

  it('refuses an old protocol and a code too short', async () => {
    const a = connect(newCode(), PROTOCOL_VERSION + 1);
    expect(((await once<Error & { data: { reason: string } }>(a, 'connect_error')).data).reason).toBe('protocol');
    const b = connect('ABC');
    expect(((await once<Error & { data: { reason: string } }>(b, 'connect_error')).data).reason).toBe('code');
    // an extension older than the server accepts (or saying no version): refused, with where to update
    for (const old of ['0.0.9', null]) {
      const c = connect(newCode(), PROTOCOL_VERSION, old);
      const e = (await once<Error & { data: { reason: string; download: string; minExtension: string } }>(c, 'connect_error')).data;
      expect(e).toMatchObject({ reason: 'outdated', minExtension: '0.1.0' });
      expect(e.download).toMatch(/^https:\/\//);
    }
  });

  it('two players: join, the first hosts, messages, reply, reaction, renew, limits, deletion', async () => {
    const codeA = newCode(), codeB = newCode();
    const a = connect(codeA), b = connect(codeB);
    const [helloA] = await Promise.all([once<{ account: { id: string; name: string } }>(a, 'hello'), once(b, 'hello')]);
    expect(helloA.account.name).toMatch(/^Joueur /);

    expect((await ask(a, 'room:check', { key: 'ZZZZ-ZZZZ' }) as { value: string }).value).toBe('unknown');
    const ja = await ask<RoomState>(a, 'room:join', { key: key.toLowerCase() });
    if (!ja.ok) throw new Error(ja.error);
    expect(ja.value.hostId).toBe(helloA.account.id);
    expect(ja.value.chat.start).toBe('begin');
    expect(ja.value.chat.messages.at(-1)?.text).toMatch(/rejoint le salon/);

    const seen = nextEvent(a, 'member');
    const jb = await ask<RoomState>(b, 'room:join', { key });
    expect(jb.ok && jb.value.members.length).toBe(2);
    expect((await seen).type).toBe('member');

    const got = nextEvent(b, 'message');
    expect((await ask(a, 'chat:send', { text: 'salut, va sur example.com' })).ok).toBe(true);
    const m = (await got) as Extract<SequencedEvent, { type: 'message' }>;
    expect(m.message.text).toBe('salut, va sur example.com');
    expect(m.message.from).toBe(helloA.account.id);

    const reply = nextEvent(a, 'message');
    await ask(b, 'chat:send', { text: 'ok', replyTo: m.message.id });
    const r = (await reply) as Extract<SequencedEvent, { type: 'message' }>;
    expect(r.message.reply).toMatchObject({ id: m.message.id, gone: false });

    const reacted = nextEvent(a, 'reactions');
    await ask(b, 'chat:react', { id: m.message.id, emoji: '👍' });
    expect(((await reacted) as Extract<SequencedEvent, { type: 'reactions' }>).reactions['👍']).toHaveLength(1);

    // a join with the device's last message: only what follows it (and the last ones kept, refreshed), not a page
    const again = await ask<RoomState>(b, 'room:join', { key, after: r.message.id });
    expect(again.ok && again.value.chat.since).toBe(0);   // fewer than 30 messages: the whole chat refreshed
    expect(again.ok && again.value.chat.messages.find(x => x.id === m.message.id)?.reactions['👍']).toHaveLength(1);
    const full = await ask<RoomState>(b, 'room:join', { key });
    expect(full.ok && full.value.chat.since).toBeUndefined();

    // renew: the same account under a new code; the old one is refused for ever
    const renewed = newCode();
    expect((await ask(a, 'account:renew', { code: renewed })).ok).toBe(true);
    const old = connect(codeA);
    expect(((await once<Error & { data: { reason: string } }>(old, 'connect_error')).data).reason).toBe('retired');
    const back = connect(renewed);
    expect((await once<{ account: { id: string } }>(back, 'hello')).account.id).toBe(helloA.account.id);
    expect((await ask<{ exists: boolean; retired: boolean }>(b, 'account:find', { code: codeA }) as { value: { retired: boolean } }).value.retired).toBe(true);
    back.close();

    // sending limit: 10 messages per 10 s (2 already sent by a and b: a has sent 1)
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await ask(a, 'chat:send', { text: `m${i}` }));
    expect(results.filter(x => !x.ok).map(x => !x.ok && x.error)).toContain('Doucement : trop de messages.');

    // the admin deletes the room: the players hear it
    const gone = once<{ key: string }>(a, 'room-gone');
    admin('rooms:delete', key, '--yes');
    expect((await gone).key).toBe(key);
    a.close(); b.close();
  }, 30_000);
});

if (!up) console.warn('Tests temps réel sautés : Postgres injoignable (pnpm services:up).');

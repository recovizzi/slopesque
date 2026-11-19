// Commands over the real server: /hote by a vote (accepted when everyone voted), /activity by the host, the social
// credit (never to oneself, said in the chat), the votes left open by a restart cancelled.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type MessageView, type RoomState, type SequencedEvent } from '@slopesque/shared';

const PORT = 3196, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(55432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000' };
let server: ChildProcess | null = null;
const start = async () => {
  server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) return; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
};
const stop = async () => { const s = server; server = null; s?.kill(); if (s) await new Promise(r => s.once('exit', r)); };
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async (code: string) => { const s = io(URL, { auth: { code, protocol: PROTOCOL_VERSION }, transports: ['websocket'], forceNew: true, reconnection: false }); await new Promise(r => s.once('hello', r)); return s; };
const nextEvent = (s: Socket, type: string, f: (e: any) => boolean = () => true) => new Promise<any>(res => { const h = (e: SequencedEvent) => { if (e.type === type && f(e)) { s.off('event', h); res(e); } }; s.on('event', h); });

describe.skipIf(!up)('commands and votes', () => {
  let key = '';
  const codes = [newCode(), newCode(), newCode()];
  let a: Socket, b: Socket, c: Socket, ids: string[] = [];
  beforeAll(async () => {
    await start();
    key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    [a, b, c] = await Promise.all(codes.map(connect)) as [Socket, Socket, Socket];
    for (const s of [a, b, c]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); ids.push(j.value.me); }
  }, 20_000);
  afterAll(async () => { for (const s of [a, b, c]) s?.close(); await stop(); });

  it('/hote: a vote; accepted when everyone voted', async () => {
    const opened = nextEvent(a, 'message', e => e.message.kind === 'vote');
    expect(await ask(b, 'host:ask')).toMatchObject({ ok: true, value: 'vote' });
    const vote = (await opened).message as MessageView;
    expect((vote.data as any).vote).toMatchObject({ kind: 'host', yes: [ids[1]], voters: ids });
    expect(await ask(c, 'host:ask')).toMatchObject({ ok: false, error: 'Un vote est déjà en cours dans le chat : attends sa fin.' });
    const host = nextEvent(a, 'host');
    await ask(a, 'vote:cast', { id: vote.id, yes: true });
    await ask(c, 'vote:cast', { id: vote.id, yes: false });
    expect((await host).hostId).toBe(ids[1]);
  });

  it('/activity: a ready activity applied by the host; a coming one refused', async () => {
    expect(await ask(b, 'activity:choose', { choice: { activity: 'chat' } })).toMatchObject({ ok: true, value: 'applied' });
    expect(await ask(b, 'activity:choose', { choice: { activity: 'cards', cardGame: 'holdem' } })).toMatchObject({ ok: false, error: 'Cette activité arrive bientôt.' });
  });

  it('social credit: never to oneself; said in the chat; the credit follows', async () => {
    expect(await ask(a, 'credit:give', { to: ids[0], delta: 10 })).toMatchObject({ ok: false, error: 'Impossible de se donner du crédit soi-même.' });
    const said = nextEvent(c, 'message', e => e.message.kind === 'credit'), member = nextEvent(c, 'member', e => e.member.id === ids[1]);
    expect((await ask(a, 'credit:give', { to: ids[1], delta: -20 })).ok).toBe(true);
    expect((await said).message.data).toMatchObject({ by: ids[0], to: ids[1], delta: -20, tier: 'mise aux fers' });
    expect((await member).member.credit).toBe(-20);
  });

  it('a vote left open by a restart is cancelled, and said', async () => {
    const opened = nextEvent(b, 'message', e => e.message.kind === 'vote');
    await ask(a, 'host:ask');
    const id = (await opened).message.id as number;
    for (const s of [a, b, c]) s.close();
    await stop();
    await start();
    a = await connect(codes[0]!);
    const j = await ask<RoomState>(a, 'room:join', { key });
    if (!j.ok) throw new Error(j.error);
    expect((j.value.chat.messages.find(m => m.id === id)?.data as any).vote.result).toBe('cancelled');
    expect(j.value.chat.messages.at(-1)?.text).toBe('Le serveur a redémarré : vote annulé.');
  }, 20_000);
});

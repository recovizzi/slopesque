// The Trou du cul over the real server: only my own hand; robots play the free seats; leaving mid-round, a robot
// finishes it and the round's points stay mine; a full round played by robots ends with the roles.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type CardsView, type RoomState } from '@slopesque/shared';

const PORT = 23193, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', ROBOT_DELAY_MS: '5' };
let server: ChildProcess;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
const cards = (s: Socket, f: (c: CardsView) => boolean) => new Promise<CardsView>(res => { const h = (e: any) => { if (e.type === 'cards' && f(e.cards)) { s.off('event', h); res(e.cards); } }; s.on('event', h); });

describe.skipIf(!up)('Trou du cul', () => {
  let host: Socket, a: Socket, me = '', keyOf = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    keyOf = key;
    host = await connect(); a = await connect();
    for (const s of [host, a]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); if (s === a) me = j.value.me; }
    await ask(a, 'disk:join');
  }, 20_000);
  afterAll(() => { host?.close(); a?.close(); server?.kill(); });

  it('a deal: my hand only; robots on the free seats; leaving mid-round keeps my points; the round ends', async () => {
    expect(await ask(host, 'cards:players', { game: 'tdc', players: 9 })).toMatchObject({ ok: false });
    expect((await ask(host, 'cards:players', { game: 'tdc', players: 3 })).ok).toBe(true);
    const seen = cards(host, v => !v.tdc && v.seats.some(s => s.user === me));   // the others see it before the deal
    expect(await ask(a, 'table:join')).toMatchObject({ ok: true, value: 'ok' });   // seated before the deal
    await seen;
    const dealt = cards(a, c => !!c.tdc);
    expect((await ask(host, 'cards:deal')).ok).toBe(true);
    const c = await dealt;
    const mine = c.seats.find(s => s.user === me)!;
    expect(c.seats.filter(s => !s.user)).toHaveLength(2);
    expect(c.tdc!.hands[mine.id]!.every(x => x.r > 0)).toBe(true);
    expect(Object.entries(c.tdc!.hands).filter(([id]) => id !== mine.id).every(([, h]) => h.every(x => x.r === 0))).toBe(true);
    const over = cards(host, v => v.tdc?.turn === null);
    expect((await ask(a, 'table:leave')).ok).toBe(true);
    const end = await over;
    expect(end.paid[mine.id]).toBe(me);
    expect(Object.values(end.tdc!.roles).sort()).toEqual(['neutre', 'president', 'tdc']);
    expect(end.seats.find(s => s.id === mine.id)?.credit).toBeNull();
    const score = async () => ((await ask<RoomState>(a, 'room:join', { key: keyOf })) as { value: RoomState }).value.members.find(m => m.id === me)!.scores;
    const before = await score();
    expect(await ask(a, 'table:join')).toMatchObject({ ok: true, value: 'ok' });
    expect(await score()).toEqual(before);   // taking a seat after the round doesn't count its points again

    // « Réinitialiser la partie »: the Trou du cul's ranking back to zero, the Palmarès kept
    await ask(host, 'activity:choose', { choice: { activity: 'cards', cardGame: 'tdc' } });
    const kept = (await ask<unknown[]>(a, 'palmares:get')) as { value: unknown[] };
    expect(kept.value.length).toBeGreaterThan(0);
    expect((await ask(a, 'game:reset')).ok).toBe(false);   // the host only
    expect((await ask(host, 'game:reset')).ok).toBe(true);
    expect((await score()).tdc).toBeUndefined();
    expect(((await ask<unknown[]>(a, 'palmares:get')) as { value: unknown[] }).value).toHaveLength(kept.value.length);

    // the game's lines belong to its session: back in the Chat, they are no longer this activity's (the clients hide them)
    const during = ((await ask<RoomState>(a, 'room:join', { key: keyOf })) as { value: RoomState }).value;
    expect(during.scope).toMatch(/^cards#\d+$/);
    expect(during.chat.messages.find(m => m.text.startsWith('Manche'))?.scope).toMatch(/^cards#\d+$/);   // a session of the cards
    await ask(a, 'chat:send', { text: 'bien joué' });
    await ask(host, 'activity:choose', { choice: { activity: 'chat' } });
    const after = ((await ask<RoomState>(a, 'room:join', { key: keyOf })) as { value: RoomState }).value;
    expect(after.scope).toMatch(/^chat#\d+$/);
    expect(after.chat.messages.find(m => m.text.startsWith('Manche'))?.scope).toMatch(/^cards#/);   // not the Chat's session: hidden now
    expect(after.chat.messages.find(m => m.text === 'bien joué')?.scope ?? null).toBeNull();   // a player's message stays
    expect(after.chat.messages.find(m => m.text.includes('passe à Chat'))?.scope ?? null).toBeNull();   // a general line stays
  }, 30_000);
});

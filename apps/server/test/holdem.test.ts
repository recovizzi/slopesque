// The Texas Hold'em over the real server: a game at 3 with robots; my two cards only; my moves checked; the host
// ends the game, the places give the points (robots: none), the Palmarès keeps my place.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type CardsView, type PalmaresEvent, type RoomState } from '@slopesque/shared';

const PORT = 23198, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', ROBOT_DELAY_MS: '5' };
let server: ChildProcess;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
const cards = (s: Socket, f: (c: CardsView) => boolean) => new Promise<CardsView>(res => { const h = (e: any) => { if (e.type === 'cards' && f(e.cards)) { s.off('event', h); res(e.cards); } }; s.on('event', h); });

describe.skipIf(!up)('Texas Hold\'em', () => {
  let host: Socket, a: Socket, me = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    host = await connect(); a = await connect();
    for (const s of [host, a]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); if (s === a) me = j.value.me; }
    expect((await ask(host, 'activity:choose', { choice: { activity: 'cards', cardGame: 'holdem' } })).ok).toBe(true);
    expect((await ask(host, 'cards:players', { game: 'holdem', players: 3 })).ok).toBe(true);
    expect((await ask(a, 'holdem:rules', { stack: 500 })).ok).toBe(false);   // the host only
    expect((await ask(host, 'holdem:rules', { stack: 500, every: 5 })).ok).toBe(true);
    expect((await ask(host, 'holdem:rules', { stack: 123 })).ok).toBe(false);
    expect((await ask(a, 'table:join')).ok).toBe(true);
  }, 20_000);
  afterAll(() => { host?.close(); a?.close(); server?.kill(); });

  it('a game: my two cards only, my turn waited for, a raise under the minimum refused; the host ends it, my place scored', async () => {
    const mine = cards(a, c => !!c.holdem && c.holdem.turn === c.seats.find(s => s.user === me)?.id);
    expect((await ask(host, 'cards:deal')).ok).toBe(true);
    const c = await mine, seat = c.seats.find(s => s.user === me)!.id, g = c.holdem!;
    expect(c.seats).toHaveLength(3);
    expect(g.stacks[seat]! + (g.paid[seat] ?? 0)).toBe(g.startStacks[seat]);   // hand 1, or a later one if the others folded before my turn
    expect(Object.values(g.stacks).reduce((x, y) => x + y, 0) + Object.values(g.paid).reduce((x, y) => x + y, 0)).toBe(1500);
    expect(g.holes[seat]!.every(x => x.r > 0)).toBe(true);
    expect(Object.entries(g.holes).filter(([s]) => s !== seat).every(([, h]) => h.every(x => x.r === 0))).toBe(true);
    expect((await ask(host, 'holdem:act', { act: 'fold' })).ok).toBe(false);   // not at the table
    const tooSmall = await ask(a, 'holdem:act', { act: 'raise', to: g.current + 1 });
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.error).toMatch(/Relance de \d+ à \d+/);
    const next = cards(a, v => !!v.holdem && (v.holdem.folded.includes(seat) || v.holdem.hand > g.hand));
    expect((await ask(a, 'holdem:act', { act: 'fold' })).ok).toBe(true);
    await next;
    const over = cards(a, v => !!v.holdem?.over);
    expect((await ask(a, 'holdem:end')).ok).toBe(false);   // the host only
    expect((await ask(host, 'holdem:end')).ok).toBe(true);
    const end = (await over).holdem!;
    expect(Object.values(end.places).sort()).toEqual([1, 2, 3]);
    const pal = await ask<PalmaresEvent[]>(a, 'palmares:get');
    expect(pal.ok && pal.value.find(e => e.game === 'holdem' && e.id === me)?.place).toBe(end.places[seat]);
  }, 30_000);

  it('robots alone (I left): the game ends by itself, nobody scores', async () => {
    const last = cards(host, () => true);
    await ask(a, 'table:leave');
    const old = (await last).holdem?.startedAt;   // the game that just ended: its last views may still come
    const over = cards(host, v => !!v.holdem && v.holdem.startedAt !== old && v.holdem.over);   // a new one, not the last views of the old one
    expect((await ask(host, 'cards:deal')).ok).toBe(true);
    const end = await over;
    expect(Object.values(end.paid).every(x => x === null)).toBe(true);
  }, 30_000);
});

// La Coinche over the real server: a game with robots; my hand only; my words and cards checked; a deal finished by
// the robots after I leave, my team's points kept; the host's target.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type CardsView, type RoomState } from '@slopesque/shared';

const PORT = 23188, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', ROBOT_DELAY_MS: '5' };
let server: ChildProcess;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
const cards = (s: Socket, f: (c: CardsView) => boolean) => new Promise<CardsView>(res => { const h = (e: any) => { if (e.type === 'cards' && f(e.cards)) { s.off('event', h); res(e.cards); } }; s.on('event', h); });

describe.skipIf(!up)('Coinche', () => {
  let host: Socket, a: Socket, me = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    host = await connect(); a = await connect();
    for (const s of [host, a]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); if (s === a) me = j.value.me; }
    expect((await ask(host, 'activity:choose', { choice: { activity: 'cards', cardGame: 'coinche' } })).ok).toBe(true);
    expect((await ask(a, 'coinche:target', { target: 1500 })).ok).toBe(false);   // the host only
    expect((await ask(host, 'coinche:target', { target: 1500 })).ok).toBe(true);
    expect((await ask(host, 'coinche:target', { target: 1234 })).ok).toBe(false);
    expect((await ask(a, 'cards:deal-mode', { mode: 'classic' })).ok).toBe(false);   // the host only
    expect((await ask(host, 'cards:deal-mode', { mode: 'classic' })).ok).toBe(true);
    expect((await ask(a, 'table:join')).ok).toBe(true);
  }, 20_000);
  afterAll(() => { host?.close(); a?.close(); server?.kill(); });

  it('a game: my hand only; a bid under the contract refused; a deal finished by the robots after I leave, my team\'s points mine', async () => {
    const mine = cards(a, c => !!c.coinche && c.coinche.phase === 'bid' && c.coinche.turn === c.seats.find(s => s.user === me)?.id);
    expect((await ask(host, 'cards:deal')).ok).toBe(true);
    const c = await mine, seat = c.seats.find(s => s.user === me)!.id, g = c.coinche!;
    expect([c.seats.length, g.target]).toEqual([4, 1500]);
    expect(g.hands[seat]!.every(x => x.r > 0)).toBe(true);
    expect(Object.entries(g.hands).filter(([s]) => s !== seat).every(([, h]) => h.every(x => x.r === 0))).toBe(true);
    if (g.contract) expect((await ask(a, 'coinche:say', { kind: 'bid', value: 80, suit: 'S' })).ok).toBe(g.contract.value < 80);
    const done = cards(host, v => !!v.coinche?.result || v.coinche?.note !== '' && v.coinche?.phase === 'done');
    expect((await ask(a, 'coinche:say', { kind: 'pass' })).ok).toBe(true);
    await ask(a, 'table:leave');
    const view = await done, end = view.coinche!;
    if (end.result) {
      expect(end.result.score[0] + end.result.score[1]).toBeGreaterThan(0);
      expect(view.paid[seat]).toBe(me);   // the deal I began: my team's points are mine
    }
  }, 30_000);
});

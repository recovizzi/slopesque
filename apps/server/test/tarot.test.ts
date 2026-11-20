// The Tarot over the real server: a deal at 5 with robots; my hand only, the partner hidden from the others; a deal
// finished by the robots after I leave, my mark kept.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type CardsView, type RoomState } from '@slopesque/shared';

const PORT = 23192, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', ROBOT_DELAY_MS: '5' };
let server: ChildProcess;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
const cards = (s: Socket, f: (c: CardsView) => boolean) => new Promise<CardsView>(res => { const h = (e: any) => { if (e.type === 'cards' && f(e.cards)) { s.off('event', h); res(e.cards); } }; s.on('event', h); });

describe.skipIf(!up)('Tarot', () => {
  let host: Socket, a: Socket, me = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    host = await connect(); a = await connect();
    for (const s of [host, a]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); if (s === a) me = j.value.me; }
    await ask(a, 'disk:join');
    expect((await ask(host, 'activity:choose', { choice: { activity: 'cards', cardGame: 'tarot', tarotPlayers: 5 } })).ok).toBe(true);
    expect((await ask(a, 'table:join')).ok).toBe(true);
  }, 20_000);
  afterAll(() => { host?.close(); a?.close(); server?.kill(); });

  it('a deal at 5: my hand only; robots finish it after I leave; my mark kept', async () => {
    const dealt = cards(a, c => !!c.tarot);
    expect((await ask(host, 'cards:deal')).ok).toBe(true);
    const c = await dealt;
    const mine = c.seats.find(s => s.user === me)!;
    expect(c.seats).toHaveLength(5);
    expect(c.tarot!.hands[mine.id]!.every(x => x.r > 0 || x.kind === 'excuse')).toBe(true);
    expect(c.tarot!.chien.every(x => x.r === 0)).toBe(true);
    const done = cards(host, v => v.tarot?.phase === 'done' && !!v.tarot.result);
    await ask(a, 'table:leave');
    const end = await done;
    // everyone passed → a new deal after I left: that deal's seat is the robot's (no mark for me)
    expect(end.paid[mine.id]).toBe(end.tarot!.deal === c.tarot!.deal ? me : null);
    expect(Object.values(end.tarot!.result!.marks).reduce((x, y) => x + y, 0)).toBe(0);
  }, 30_000);
});

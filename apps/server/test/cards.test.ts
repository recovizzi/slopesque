// The Trou du cul over the real server: only my own hand; robots play the free seats; leaving mid-round, a robot
// finishes it and the round's points stay mine; a full round played by robots ends with the roles.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type CardsView, type RoomState } from '@slopesque/shared';

const PORT = 3193, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(55432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', ROBOT_DELAY_MS: '5' };
let server: ChildProcess;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
const cards = (s: Socket, f: (c: CardsView) => boolean) => new Promise<CardsView>(res => { const h = (e: any) => { if (e.type === 'cards' && f(e.cards)) { s.off('event', h); res(e.cards); } }; s.on('event', h); });

describe.skipIf(!up)('Trou du cul', () => {
  let host: Socket, a: Socket, me = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    host = await connect(); a = await connect();
    for (const s of [host, a]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); if (s === a) me = j.value.me; }
    await ask(a, 'disk:join');
  }, 20_000);
  afterAll(() => { host?.close(); a?.close(); server?.kill(); });

  it('a deal: my hand only; robots on the free seats; leaving mid-round keeps my points; the round ends', async () => {
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
    expect(await ask(a, 'table:join')).toMatchObject({ ok: true, value: 'ok' });
  }, 30_000);
});

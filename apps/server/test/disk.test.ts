// The Demi-disque over the real server: the host's ray hidden from the others, the reveal as soon as every candidate
// validated, the scores, the rules waiting for the end of the round.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type DiskView, type RoomState } from '@slopesque/shared';

const PORT = 23195, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000' };
let server: ChildProcess;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
const disk = (s: Socket, f: (d: DiskView) => boolean) => new Promise<DiskView>(res => { const h = (e: { type: string; disk: DiskView }) => { if (e.type === 'disk' && f(e.disk)) { s.off('event', h); res(e.disk); } }; s.on('event', h); });

describe.skipIf(!up)('Demi-disque', () => {
  let host: Socket, a: Socket, b: Socket, ids: string[] = [];
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    host = await connect(); a = await connect(); b = await connect();
    for (const s of [host, a, b]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); ids.push(j.value.me); }
    for (const s of [a, b]) expect((await ask(s, 'disk:join')).ok).toBe(true);
  }, 20_000);
  afterAll(() => { for (const s of [host, a, b]) s?.close(); server?.kill(); });

  it('only the host starts; his ray hidden from the others', async () => {
    expect(await ask(a, 'disk:start', { word: 'France', target: 40 })).toMatchObject({ ok: false, error: 'Seul l\'hôte peut faire ça.' });
    const seenA = disk(a, d => d.phase === 'guessing'), seenH = disk(host, d => d.phase === 'guessing');
    expect((await ask(host, 'disk:start', { word: 'France', target: 40 })).ok).toBe(true);
    expect((await seenA).target).toBeNull();
    expect((await seenH).target).toBe(40);
  });

  it('rules changed during the round wait; the reveal comes when everyone validated', async () => {
    expect(await ask(host, 'disk:rules', { roundSeconds: 60 })).toMatchObject({ ok: true, value: 'pending' });
    expect((await ask(a, 'disk:guess', { value: 41 })).ok).toBe(true);
    expect(await ask(a, 'disk:guess', { value: 10 })).toMatchObject({ ok: false, error: 'Tu as déjà validé.' });
    const revealed = disk(b, d => d.phase === 'reveal');
    await ask(b, 'disk:guess', { value: 90 });
    const d = await revealed;
    expect(d.target).toBe(40);
    expect(d.results[ids[1]!]).toMatchObject({ points: 150, perfect: true });
    expect(d.results[ids[2]!]!.points).toBe(0);
    expect(d.rules.roundSeconds).toBe(60);
  });

  it('the format chosen with the activity sets the voting mode (Amphithéâtre), and back', async () => {
    const amphi = disk(a, d => d.rules.mode === 'amphi');
    expect((await ask(host, 'activity:choose', { choice: { activity: 'disk', mode: 'amphi' } })).ok).toBe(true);
    expect((await amphi).rules.mode).toBe('amphi');
    const ray = disk(a, d => d.rules.mode === 'ray');
    expect((await ask(host, 'activity:choose', { choice: { activity: 'disk', mode: 'ray' } })).ok).toBe(true);
    expect((await ray).rules.mode).toBe('ray');
  });
});

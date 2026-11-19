// /effet over the real server: sent to everyone on the « fx » channel (not numbered, not kept), 3 fireworks at once at
// most, one effect on a photo at a time and only on a player of the room, a screamer's image relayed (never stored).
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type EffectView, type RoomState } from '@slopesque/shared';

const PORT = 23191, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000' };
let server: ChildProcess | null = null;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
const fx = (s: Socket) => new Promise<EffectView>(res => s.once('fx', res));

describe.skipIf(!up)('/effet', () => {
  let a: Socket, b: Socket, c: Socket, idB = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    a = await connect(); b = await connect(); c = await connect();
    for (const s of [a, b, c]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); if (s === b) idB = j.value.me; }
  }, 20_000);
  afterAll(() => { for (const s of [a, b, c]) s?.close(); server?.kill(); });

  it('fireworks for everyone, three at once at most', async () => {
    const seen = fx(b);
    for (let i = 0; i < 3; i++) expect((await ask(a, 'effect:play', { kind: 'firework' })).ok).toBe(true);
    expect((await seen).kind).toBe('firework');
    expect(await ask(a, 'effect:play', { kind: 'firework' })).toMatchObject({ ok: false, error: '3 feux d\'artifice sont déjà en cours : attends un instant.' });
  });

  it('on a photo: a player of the room, one at a time; confetti in his colour', async () => {
    expect(await ask(c, 'effect:play', { kind: 'tomato' })).toMatchObject({ ok: false });
    expect(await ask(c, 'effect:play', { kind: 'tomato', target: '00000000-0000-4000-8000-000000000000' })).toMatchObject({ ok: false, error: 'Ce joueur n\'est pas dans le salon.' });
    const seen = fx(b);
    expect((await ask(c, 'effect:play', { kind: 'tomato', target: idB })).ok).toBe(true);
    expect(await seen).toMatchObject({ kind: 'tomato', target: idB });
    expect(await ask(c, 'effect:play', { kind: 'hammer', target: idB })).toMatchObject({ ok: false, error: 'Un effet est déjà en cours sur une photo : attends sa fin.' });
    const colour = fx(a);
    expect((await ask(c, 'effect:play', { kind: 'confetti', target: idB })).ok).toBe(true);
    expect(typeof (await colour).hue).toBe('number');
  });

  it('a screamer: an emoji, or an image relayed as it is; anything else refused', async () => {
    expect(await ask(b, 'effect:play', { kind: 'screamer', pic: { kind: 'image', value: 'https://example.com/x.png' } })).toMatchObject({ ok: false });
    expect(await ask(b, 'effect:play', { kind: 'screamer', pic: { kind: 'gif', value: 'https://evil.example/x.gif' } })).toMatchObject({ ok: false });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const seen = fx(a);
    expect((await ask(b, 'effect:play', { kind: 'screamer', pic: { kind: 'image', value: png } })).ok).toBe(true);
    expect((await seen).pic).toEqual({ kind: 'image', src: png });
    expect(await ask(b, 'effect:play', { kind: 'screamer', pic: { kind: 'emoji', value: '😱' } })).toMatchObject({ ok: false, error: 'Un screamer est déjà affiché : attends sa fin.' });
  });
});

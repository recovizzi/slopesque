// Pictures over the real server: one copy per (usage, file), the old profile photo deleted at once, GIFs without a key.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import sharp from 'sharp';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type GifPage, type RoomState, type SequencedEvent, type UploadResult } from '@slopesque/shared';

const PORT = 3197, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(55432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', KLIPY_API_KEY: '', GIPHY_API_KEY: '' };
let server: ChildProcess;
const admin = (...args: string[]) => execFileSync(process.execPath, ['dist/admin.js', ...args], { env, encoding: 'utf8' });
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const nextEvent = (s: Socket, type: string) => new Promise<SequencedEvent>(res => { const f = (e: SequencedEvent) => { if (e.type === type) { s.off('event', f); res(e); } }; s.on('event', f); });
const png = (r: number, g: number, b: number, w = 900, h = 600) => sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();

async function send(s: Socket, usage: string, body: Buffer) {
  const t = await ask<{ ticket: string; url: string }>(s, 'media:ticket', { usage });
  if (!t.ok) throw new Error(t.error);
  return (await (await fetch(t.value.url, { method: 'POST', headers: { 'x-ticket': t.value.ticket, 'content-type': 'image/png' }, body })).json()) as UploadResult;
}

describe.skipIf(!up)('pictures', () => {
  let s: Socket;
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = admin('rooms:create').match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION }, transports: ['websocket'], forceNew: true });
    await new Promise(r => s.once('hello', r));
    const j = await ask<RoomState>(s, 'room:join', { key });
    expect(j.ok).toBe(true);
  }, 20_000);
  afterAll(() => { s?.close(); server?.kill(); });

  it('converts by usage, keeps one copy per file and usage', async () => {
    const file = await png(200, 40, 40, 2400, 1600);
    const a = await send(s, 'chat', file), b = await send(s, 'chat', file), c = await send(s, 'sticker', file);
    if (!a.ok || !b.ok || !c.ok) throw new Error('upload failed');
    expect(a.value.id).toBe(b.value.id);
    expect(c.value.id).not.toBe(a.value.id);
    expect([a.value.w, a.value.h]).toEqual([1600, 1067]);
    expect(Math.max(c.value.w, c.value.h)).toBe(256);
    const img = await fetch(a.value.url);
    expect(img.headers.get('content-type')).toBe('image/webp');
    expect(img.headers.get('cache-control')).toMatch(/immutable/);
    const msg = nextEvent(s, 'message');
    expect((await ask(s, 'chat:media', { mediaId: a.value.id })).ok).toBe(true);
    const m = (await msg) as Extract<SequencedEvent, { type: 'message' }>;
    expect(m.message.media).toMatchObject({ kind: 'image', src: a.value.url });
  });

  it('an upload is good only for the usage of its ticket; a ticket is used once', async () => {
    const r = await send(s, 'photo', await png(1, 2, 3));
    if (!r.ok) throw new Error(r.error);
    expect((await ask(s, 'chat:media', { mediaId: r.value.id })).ok).toBe(false);
    const t = await ask<{ ticket: string; url: string }>(s, 'media:ticket', { usage: 'chat' });
    if (!t.ok) throw new Error(t.error);
    const once = async () => (await (await fetch(t.value.url, { method: 'POST', headers: { 'x-ticket': t.value.ticket }, body: await png(9, 9, 9) })).json()) as UploadResult;
    expect((await once()).ok).toBe(true);
    expect(await once()).toMatchObject({ ok: false, error: 'Envoi expiré : réessaie.' });
  });

  it('a replaced photo is deleted at once; a removed photo brings the letter back', async () => {
    const first = await send(s, 'photo', await png(10, 120, 200)), second = await send(s, 'photo', await png(200, 120, 10));
    if (!first.ok || !second.ok) throw new Error('upload failed');
    const member = () => nextEvent(s, 'member') as Promise<Extract<SequencedEvent, { type: 'member' }>>;
    let ev = member();
    await ask(s, 'photo:set', { mediaId: first.value.id });
    expect((await ev).member.photo).toBe(first.value.url);
    ev = member();
    await ask(s, 'photo:set', { mediaId: second.value.id });
    expect((await ev).member.photo).toBe(second.value.url);
    expect((await fetch(first.value.url)).status).toBe(404);
    ev = member();
    await ask(s, 'photo:set', { mediaId: null });
    expect((await ev).member.photo).toBeNull();
    expect((await fetch(second.value.url)).status).toBe(404);
  });

  it('stickers: added, sent, removed (deleted with their picture)', async () => {
    const r = await send(s, 'sticker', await png(30, 200, 90, 300, 300));
    if (!r.ok) throw new Error(r.error);
    const st = nextEvent(s, 'stickers');
    await ask(s, 'sticker:add', { mediaId: r.value.id, send: true });
    const list = ((await st) as Extract<SequencedEvent, { type: 'stickers' }>).stickers;
    expect(list[0]?.src).toBe(r.value.url);
    const gone = nextEvent(s, 'stickers');
    await ask(s, 'sticker:remove', { id: list[0]!.id });
    expect(((await gone) as Extract<SequencedEvent, { type: 'stickers' }>).stickers).toHaveLength(0);
    expect((await fetch(r.value.url)).status).toBe(404);
  });

  it('GIFs without a key: the reason, no crash', async () => {
    const r = await ask<GifPage>(s, 'gif:search', { q: 'bravo', page: 0 });
    expect(r).toMatchObject({ ok: true, value: { items: [], error: 'no-key' } });
  });
});

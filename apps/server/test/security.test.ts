// The holes closed by the security review of 2026-11-20 (SECURITE.md), so they stay closed.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type RoomState } from '@slopesque/shared';
import { privateIp } from '../src/external/safe-fetch.js';

const PORT = 23189, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000' };
let server: ChildProcess | null = null;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async (code = newCode()) => { const s = io(URL, { auth: { code, protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true, reconnection: false }); await new Promise(r => s.once('hello', r)); return s; };

describe('the SSRF filter', () => {
  it('refuses the internal addresses, IPv4 written inside IPv6 too', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.18.0.2', '::1', '::ffff:7f00:1', '::ffff:127.0.0.1', '::ffff:ac12:2', '64:ff9b::7f00:1', '198.18.0.5', 'fd00::1']) expect(privateIp(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '2606:4700::1111', '::ffff:808:808']) expect(privateIp(ip), ip).toBe(false);
  });
});

describe.skipIf(!up)('closed holes', () => {
  let a: Socket, b: Socket, keyA = '', keyB = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    keyA = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    keyB = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    a = await connect(); b = await connect();
    await ask(a, 'room:join', { key: keyA }); await ask(b, 'room:join', { key: keyB });
  }, 20_000);
  afterAll(() => { a?.close(); b?.close(); server?.kill(); });

  it('a reply never shows a message of another room', async () => {
    await ask(a, 'chat:send', { text: 'secret de la salle A' });
    const idA = ((await ask<RoomState>(a, 'room:join', { key: keyA })) as { value: RoomState }).value.chat.messages.find(m => m.text === 'secret de la salle A')!.id;
    expect((await ask(b, 'chat:send', { text: 'curieux', replyTo: idA })).ok).toBe(true);
    const seen = ((await ask<RoomState>(b, 'room:join', { key: keyB })) as { value: RoomState }).value.chat.messages.find(m => m.text === 'curieux')!;
    expect(seen.reply?.text ?? '').not.toContain('secret');
  });

  it('an upload without a ticket is refused before its body is read', async () => {
    const r = await fetch(`${URL}/api/media`, { method: 'POST', headers: { 'x-ticket': 'nope' }, body: new Uint8Array(5 * 1024 * 1024) });
    expect(r.status).toBe(403);
  });

  it('a GIF is a https link to KLIPY or GIPHY only', async () => {
    for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'https://tracker.example/x.gif'])
      expect((await ask(b, 'chat:gif', { gif: { id: '1', provider: 'X', url, w: 1, h: 1, title: 'x' } })).ok, url).toBe(false);
  });

  it('a new account is never made under a weak code', async () => {
    const s = io(URL, { auth: { code: 'AAAA-AAAA-AAAA-AAAA', protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true, reconnection: false });
    const e = await new Promise<{ data?: { reason: string } }>(r => s.once('connect_error', r));
    expect(e.data?.reason).toBe('code');
    s.close();
  });
});

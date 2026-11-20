// « Reprendre un compte »: three unknown codes from an address, then 5 min to wait (even a right code waits); a right
// code before counts from zero again; checking that a new code is free never counts. Addresses simulated (TRUST_PROXY).
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION } from '@slopesque/shared';

const PORT = 23190, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000', TRUST_PROXY: 'true' };
let server: ChildProcess | null = null;
const from = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const check = async (code: string, resume: boolean, ip = from) => (await fetch(`${URL}/api/account/check`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ code, resume }) })).json() as Promise<{ ok: boolean; error?: string; value?: { exists: boolean; triesLeft?: number } }>;

describe.skipIf(!up)('a code to take an account back', () => {
  let mine = '';
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    mine = newCode();
    const s = io(URL, { auth: { code: mine, protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true });   // the account exists
    await new Promise(r => s.once('hello', r));
    s.close();
  }, 20_000);
  afterAll(() => { server?.kill(); });

  it('three unknown codes, then 5 min to wait', async () => {
    expect(await check(newCode(), true)).toMatchObject({ ok: true, value: { exists: false, triesLeft: 2 } });
    expect(await check(newCode(), true)).toMatchObject({ ok: true, value: { exists: false, triesLeft: 1 } });
    expect(await check(mine, true)).toMatchObject({ ok: true, value: { exists: true } });   // the right one: from zero again
    expect(await check(newCode(), true)).toMatchObject({ ok: true, value: { triesLeft: 2 } });
    expect(await check(newCode(), true)).toMatchObject({ ok: true, value: { triesLeft: 1 } });
    expect(await check(newCode(), true)).toMatchObject({ ok: false, error: 'Trois codes inconnus : réessaie dans 5 min.' });
    expect((await check(mine, true)).ok).toBe(false);   // locked: even the right code waits
    expect((await check(newCode(), false)).ok).toBe(true);   // a new code checked as free: not concerned
    expect(await check(mine, true, `${from}9`)).toMatchObject({ ok: true, value: { exists: true } });   // another address
  });
});

// Sondage and Roulette over the real server: answers hidden while open, closed when every candidate answered, secret
// results without names; the wheel drawn by the server, the same for everyone.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { newCode } from '@slopesque/engines';
import { PROTOCOL_VERSION, type Ack, type ChatPollView, type MessageView, type PollView, type RoomState, type WheelView } from '@slopesque/shared';

const PORT = 23194, URL = `http://localhost:${PORT}`;
const up = await new Promise<boolean>(res => { const s = net.connect(23432, 'localhost').on('connect', () => { s.destroy(); res(true); }).on('error', () => res(false)); });
const env = { ...process.env, PORT: String(PORT), PUBLIC_URL: URL, LOG_LEVEL: 'warn', CODE_ATTEMPTS_PER_MINUTE: '1000' };
let server: ChildProcess;
const ask = <T>(s: Socket, ev: string, body: unknown = {}) => s.emitWithAck(ev, body) as Promise<Ack<T>>;
const connect = async () => { const s = io(URL, { auth: { code: newCode(), protocol: PROTOCOL_VERSION, version: '0.1.0' }, transports: ['websocket'], forceNew: true }); await new Promise(r => s.once('hello', r)); return s; };
function next<T>(s: Socket, type: 'poll' | 'wheel', f: (v: T) => boolean) { return new Promise<T>(res => { const h = (e: any) => { if (e.type === type && f(e[type])) { s.off('event', h); res(e[type]); } }; s.on('event', h); }); }

describe.skipIf(!up)('Sondage and Roulette', () => {
  let host: Socket, a: Socket, b: Socket, ids: string[] = [];
  beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)); }
    const key = execFileSync(process.execPath, ['dist/admin.js', 'rooms:create'], { env, encoding: 'utf8' }).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
    host = await connect(); a = await connect(); b = await connect();
    for (const s of [host, a, b]) { const j = await ask<RoomState>(s, 'room:join', { key }); if (!j.ok) throw new Error(j.error); ids.push(j.value.me); }
    for (const s of [a, b]) await ask(s, 'disk:join');
  }, 20_000);
  afterAll(() => { for (const s of [host, a, b]) s?.close(); server?.kill(); });

  it('a secret poll: answers hidden while open, results without names', async () => {
    await ask(host, 'poll:settings', { secret: true });
    const open = next<PollView>(a, 'poll', p => p.phase === 'open');
    expect((await ask(host, 'poll:publish', { kind: 'choices', question: 'Où ?', choices: ['Japon', 'Islande'], pics: [null, null] })).ok).toBe(true);
    expect((await open).poll?.question).toBe('Où ?');
    const seen = next<PollView>(b, 'poll', p => p.answered.length === 1);
    await ask(a, 'poll:answer', { answer: 0 });
    const v = await seen;
    expect([v.mine, v.answers]).toEqual([null, null]);
    const done = next<PollView>(host, 'poll', p => p.phase === 'results');
    await ask(b, 'poll:answer', { answer: 0 });
    const r = await done;
    expect(r.outcome?.winner).toBe('0');
    expect(Object.keys(r.answers!).some(k => ids.includes(k))).toBe(false);
    expect(r.outcome?.ranked[0]?.ids).toEqual([]);
  });

  it('the activity changes while a poll is open: it goes on in the chat, answered there, its results shown there', async () => {
    await ask(host, 'poll:settings', { secret: false });
    if ((await ask(host, 'poll:next')).ok === false) { /* already blank */ }
    expect((await ask(host, 'activity:choose', { choice: { activity: 'poll' } })).ok).toBe(true);
    expect((await ask(host, 'poll:publish', { kind: 'choices', question: 'On mange où ?', choices: ['Pizza', 'Sushi'], pics: [null, null] })).ok).toBe(true);
    await ask(a, 'poll:answer', { answer: 1 });   // an answer before the change: kept
    const moved = new Promise<MessageView>(res => { const h = (e: any) => { if (e.type === 'message' && e.message.kind === 'poll') { b.off('event', h); res(e.message); } }; b.on('event', h); });
    const blank = next<PollView>(b, 'poll', p => p.phase === 'writing');
    expect((await ask(host, 'activity:choose', { choice: { activity: 'chat' } })).ok).toBe(true);
    const m = await moved, cp = m.data!.chatPoll as ChatPollView;
    expect([cp.poll.question, cp.closed, cp.answered, cp.answers]).toEqual(['On mange où ?', false, [ids[1]], null]);   // who answered, not what
    expect((await blank).poll).toBeNull();   // the Sondage starts again blank
    expect((await ask(a, 'poll:chat-answer', { id: m.id, answer: 0 })).ok).toBe(false);   // once
    expect((await ask(b, 'poll:chat-answer', { id: m.id, answer: 9 })).ok).toBe(false);   // not a choice
    expect((await ask(a, 'poll:chat-end', { id: m.id })).ok).toBe(false);   // its host only
    const done = new Promise<ChatPollView>(res => { const h = (e: any) => { const c = e.message?.data?.chatPoll; if (e.type === 'message-updated' && e.message.id === m.id && c?.closed) { host.off('event', h); res(c); } }; host.on('event', h); });
    expect((await ask(b, 'poll:chat-answer', { id: m.id, answer: 0 })).ok).toBe(true);   // every connected player but its host: closed
    const r = await done;
    expect(r.outcome?.ranked.map(x => x.value)).toEqual([1, 1]);
    expect(r.answers).toEqual({ [ids[1]!]: 1, [ids[2]!]: 0 });
    expect((await ask(b, 'poll:chat-answer', { id: m.id, answer: 1 })).ok).toBe(false);   // closed
  });

  it('the wheel: drawn by the server, the same spin for everyone', async () => {
    await ask(host, 'wheel:set', { items: [{ label: 'Pizza', weight: '' }, { label: 'Sushi', weight: '' }] });
    const sa = next<WheelView>(a, 'wheel', w => w.phase === 'spinning'), sb = next<WheelView>(b, 'wheel', w => w.phase === 'spinning');
    expect((await ask(host, 'wheel:spin')).ok).toBe(true);
    const [wa, wb] = await Promise.all([sa, sb]);
    expect(wa.spin).toEqual(wb.spin);
    expect(await ask(a, 'wheel:spin')).toMatchObject({ ok: false });
  });
});

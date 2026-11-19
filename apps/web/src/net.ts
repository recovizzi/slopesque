// The connection to the server (openspec: realtime-sync): Socket.IO with my code in `auth`, reconnection from 0.5 s to
// 10 s, the room joined again after each reconnection (full state), events applied in order.
import { io, type Socket } from 'socket.io-client';
import { PROTOCOL_VERSION, type Ack, type FatalReason, type Hello, type IntentName, type IntentResults, type RoomState, type SequencedEvent } from '@slopesque/shared';
import { useStore } from './store';

let socket: Socket | null = null;
const FATAL: FatalReason[] = ['protocol', 'code', 'retired', 'replaced'];

export function connect() {
  const { device, set } = useStore.getState();
  socket?.close();
  if (!device.code) return;
  set({ conn: 'connecting', fatal: null });
  const s = io(device.server, { auth: { code: device.code, protocol: PROTOCOL_VERSION }, transports: ['websocket'],
    reconnectionDelay: 500, reconnectionDelayMax: 10_000, timeout: 8000 });
  socket = s;
  s.on('hello', (h: Hello) => {
    set({ conn: 'ok', account: h.account, insecure: h.insecure, clockSkew: h.serverTime - Date.now() });
    const key = useStore.getState().device.roomKey;
    if (key) void join(key, true);
  });
  s.on('connect_error', (e: Error & { data?: { reason?: FatalReason } }) => {
    const reason = e.data?.reason;
    if (reason && FATAL.includes(reason)) { s.close(); set({ conn: 'idle', fatal: reason }); return; }
    if (reason === 'limited') set({ fatal: 'limited' });
    const st = useStore.getState();
    set({ conn: st.account ? 'reconnecting' : 'offline', roomStatus: st.room ? st.roomStatus : st.device.roomKey ? 'offline' : st.roomStatus });
  });
  s.on('disconnect', () => { if (useStore.getState().conn === 'ok') set({ conn: 'reconnecting' }); });
  s.on('fatal', (f: { reason: FatalReason }) => { s.close(); set({ conn: 'idle', fatal: f.reason }); });
  s.on('event', (e: SequencedEvent) => { if (useStore.getState().apply(e) === 'gap') void join(useStore.getState().device.roomKey, true); });
  s.on('room-gone', () => set({ room: null, roomStatus: 'unknown' }));
}

export function disconnect() { socket?.close(); socket = null; }

export async function request<N extends IntentName>(name: N, body: unknown = {}): Promise<Ack<IntentResults[N]>> {
  if (!socket?.connected) return { ok: false, error: 'Pas de connexion au serveur.' };
  try { return await socket.timeout(10_000).emitWithAck(name, body); } catch { return { ok: false, error: 'Le serveur ne répond pas.' }; }
}

/** Enters a room (or again after a reconnection or a gap): its full state, or why not. */
export async function join(key: string, again = false) {
  const st = useStore.getState();
  if (!again) st.set({ roomStatus: 'loading', room: null });
  st.setDevice({ roomKey: key });
  const r = await request('room:join', { key });
  if (useStore.getState().device.roomKey !== key) return;   // another room asked since
  if (r.ok) {
    const st = useStore.getState();
    st.set({ room: r.value as RoomState, roomStatus: 'ok' });
    const acc = st.account;
    if (acc?.rooms.some(x => x.key === key && x.pending)) {   // an admin created it since: no longer pending
      const rooms = acc.rooms.map(x => (x.key === key ? { ...x, pending: false } : x));
      st.set({ account: { ...acc, rooms } });
      void request('rooms:save', { rooms });
    }
    return;
  }
  const pending = useStore.getState().account?.rooms.find(x => x.key === key)?.pending;
  useStore.getState().set({ room: null, roomStatus: r.error === 'unknown' ? (pending ? 'pending' : 'unknown') : 'offline' });
}

/** HTTP, before any connection: does an account have this code? */
export async function checkCode(server: string, code: string): Promise<Ack<IntentResults['account:find']>> {
  try {
    const r = await fetch(`${server.replace(/\/+$/, '')}/api/account/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(8000) });
    return await r.json();
  } catch { return { ok: false, error: `Serveur injoignable : ${server}` }; }
}

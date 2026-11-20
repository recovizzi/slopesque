// Reading a page for a player (link previews): http(s) only, never an internal address (checked after each of at most
// 3 redirects), 3 s and a size cap (openspec: chat-activity, Aperçu des liens — SSRF).
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  // an IPv4 inside an IPv6 (« ::ffff:127.0.0.1 », that URL parsing writes « ::ffff:7f00:1 »; NAT64 « 64:ff9b::… »):
  // unwrapped, then checked as IPv4
  const wrapped = /^(?:::ffff:|::ffff:0:|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(v);
  if (wrapped) return privateIp(wrapped[1] ?? [parseInt(wrapped[2]!, 16) >> 8, parseInt(wrapped[2]!, 16) & 255, parseInt(wrapped[3]!, 16) >> 8, parseInt(wrapped[3]!, 16) & 255].join('.'));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') || v.startsWith('64:ff9b:');
}

async function allowed(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false;
  try {
    const all = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    return all.length > 0 && all.every(a => !privateIp(a.address));
  } catch { return false; }
}

export async function safeFetch(url: string, opts: { maxBytes: number; accept: string; timeoutMs?: number }): Promise<{ url: string; type: string; body: Buffer } | null> {
  let current = new URL(url);
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 3000);
  for (let hop = 0; hop <= 3; hop++) {
    if (!(await allowed(current))) return null;
    let r: Response;
    try { r = await fetch(current, { redirect: 'manual', signal, headers: { accept: opts.accept, 'user-agent': 'Mozilla/5.0 (compatible; SlopesqueBot/1.0; +link preview)' } }); } catch { return null; }
    if (r.status >= 300 && r.status < 400) {
      const to = r.headers.get('location');
      if (!to) return null;
      current = new URL(to, current);
      continue;
    }
    if (!r.ok || !r.body) return null;
    const chunks: Buffer[] = [];
    let size = 0;
    const reader = r.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > opts.maxBytes) { await reader.cancel(); break; }
        chunks.push(Buffer.from(value));
      }
    } catch { return null; }
    return { url: current.toString(), type: r.headers.get('content-type') ?? '', body: Buffer.concat(chunks) };
  }
  return null;
}

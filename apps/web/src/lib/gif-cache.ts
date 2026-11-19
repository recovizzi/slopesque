// The GIFs of the chat kept on this device (openspec: chat-activity, GIF): a message only holds the provider's link,
// each player loads the file once from the provider and keeps it here (the browser's Cache API, the 300 last), so our
// server never stores nor serves a GIF. Not cached (a refused fetch, no Cache API): the link itself.
const NAME = 'slp-gifs-v1', MAX = 300;
const urls = new Map<string, Promise<string>>();   // this session's object URLs, one per GIF

async function load(url: string) {
  try {
    const cache = await caches.open(NAME);
    let r = await cache.match(url);
    if (!r) {
      const got = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!got.ok || !(got.headers.get('content-type') ?? '').startsWith('image/')) return url;
      await cache.put(url, got.clone());
      r = got;
      void cache.keys().then(keys => Promise.all(keys.slice(0, Math.max(0, keys.length - MAX)).map(k => cache.delete(k))));   // the oldest go
    }
    return URL.createObjectURL(await r.blob());
  } catch { return url; }
}

/** The GIF's address on this device (an object URL once kept), its link while loading or if it can't be kept. */
export function localGif(url: string) {
  let p = urls.get(url);
  if (!p) { p = load(url); urls.set(url, p); }
  return p;
}

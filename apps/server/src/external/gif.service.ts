// GIFs (openspec: chat-activity, Fournisseurs de GIF; external-services): KLIPY, then GIPHY, then KLIPY with ads as a
// fallback chain (design.md decision 19), the
// keys on the server only; a search and its next pages stay with one provider; results kept in Redis (search 1 h,
// trending 15 min) for every player; a failing provider is skipped 5 min. Without any key the window says so.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RETENTION, type GifPage, type GifRef } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { CacheService } from '../cache/cache.service.js';

const PER_PAGE = 24, TIMEOUT = 5000;
type Failure = 'refused' | 'down';
interface Provider { name: string; fetch(q: string | null, page: number): Promise<{ items: GifRef[]; hasNext: boolean }> }

class ProviderError extends Error { constructor(readonly kind: Failure, msg: string) { super(msg); } }

async function getJson(url: string) {
  let r: Response;
  try { r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { accept: 'application/json' } }); } catch (e) { throw new ProviderError('down', (e as Error).message); }
  if (r.status === 401 || r.status === 403) throw new ProviderError('refused', `HTTP ${r.status}`);
  if (!r.ok) throw new ProviderError('down', `HTTP ${r.status}`);
  try { return await r.json() as any; } catch { throw new ProviderError('down', 'réponse invalide'); }
}

// ads: asked only with the key « avec pub »; how to show them in the extension (its CSP blocks their scripts, their
// format not seen yet) is an open question: they are logged, not shown
const AD = { 'ad-min-width': '50', 'ad-max-width': '380', 'ad-min-height': '50', 'ad-max-height': '250', 'ad-language': 'fr' };
let adSeen = false;
const klipy = (key: string, ads: boolean): Provider => ({
  name: ads ? 'KLIPY-PUB' : 'KLIPY',
  async fetch(q, page) {
    const base = `https://api.klipy.com/api/v1/${encodeURIComponent(key)}/gifs/${q ? 'search' : 'trending'}`;
    const j = await getJson(`${base}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1), per_page: String(PER_PAGE), locale: 'fr_FR', customer_id: 'slopesque', ...(ads ? AD : {}) })}`);
    const list: any[] = j?.data?.data ?? [];
    const ad = list.find(x => x?.type === 'ad');
    if (ad && !adSeen) { adSeen = true; new Logger('GIF').warn(`KLIPY : une pub reçue (champs : ${Object.keys(ad).join(', ')}) ; pas encore affichée`); }
    const items = list.filter(x => x?.type !== 'ad').map((x): GifRef | null => {
      const f = x?.file?.sm ?? x?.file?.md ?? x?.file?.hd;   // sm: ~200 px wide, the weight of a chat GIF
      const pick = f?.webp ?? f?.gif;
      return pick?.url ? { id: String(x.id ?? x.slug), provider: 'KLIPY', url: pick.url, w: Number(pick.width) || 240, h: Number(pick.height) || 180, title: String(x.title ?? 'GIF') } : null;
    }).filter((x): x is GifRef => !!x);
    return { items, hasNext: !!j?.data?.has_next };
  },
});

const giphy = (key: string): Provider => ({
  name: 'GIPHY',
  async fetch(q, page) {
    const params = new URLSearchParams({ api_key: key, limit: String(PER_PAGE), offset: String(page * PER_PAGE), rating: 'r', ...(q ? { q, lang: 'fr' } : {}) });
    const j = await getJson(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?${params}`);
    const items = (j?.data ?? []).map((x: any): GifRef | null => {
      const f = x?.images?.fixed_width;
      return f?.url ? { id: String(x.id), provider: 'GIPHY', url: f.webp || f.url, w: Number(f.width) || 200, h: Number(f.height) || 150, title: String(x.title || 'GIF') } : null;
    }).filter((x: GifRef | null): x is GifRef => !!x);
    const p = j?.pagination;
    return { items, hasNext: p ? p.offset + p.count < Math.min(p.total_count ?? 0, 4999) : items.length === PER_PAGE };
  },
});

@Injectable()
export class GifService {
  private readonly log = new Logger('GIF');
  private readonly providers: Provider[];

  constructor(@Inject(ENV) env: Env, private readonly cache: CacheService) {
    this.providers = [env.KLIPY_API_KEY && klipy(env.KLIPY_API_KEY, false), env.GIPHY_API_KEY && giphy(env.GIPHY_API_KEY),
      env.KLIPY_API_KEY_WITH_AD && klipy(env.KLIPY_API_KEY_WITH_AD, true)].filter((p): p is Provider => !!p);
    if (!this.providers.length) this.log.warn('aucune clé (KLIPY_API_KEY, GIPHY_API_KEY, KLIPY_API_KEY_WITH_AD) : la fenêtre GIF le dira');
  }

  get configured() { return this.providers.map(p => p.name); }

  /** A page of results; `stick`: the provider of the first page (a grid never mixes providers). */
  async page(q: string | null, page: number, stick?: string | null): Promise<GifPage> {
    if (!this.providers.length) return { items: [], next: null, provider: null, error: 'no-key' };
    const norm = q?.trim().toLowerCase().replace(/\s+/g, ' ') ?? null;
    const chain = stick ? this.providers.filter(p => p.name === stick) : this.providers;
    let failure: Failure = 'down';
    for (const p of chain) {
      if (await this.cache.get(`gif:down:${p.name}`)) continue;
      const key = `gif:${p.name}:${norm ?? '#trending'}:${page}`;
      const hit = await this.cache.get<GifPage>(key);
      if (hit) return hit;
      try {
        const r = await p.fetch(norm, page);
        const out: GifPage = { items: r.items, next: r.hasNext ? page + 1 : null, provider: p.name, error: null };
        await this.cache.set(key, out, norm ? RETENTION.gifSearch : RETENTION.gifTrending);
        return out;
      } catch (e) {
        const err = e as ProviderError;
        failure = err.kind === 'refused' && failure !== 'down' ? 'refused' : err.kind ?? 'down';
        this.log.warn(`${p.name} : ${err.kind === 'refused' ? 'clé refusée' : 'pas de réponse'} (${err.message}) ; essai du suivant`);
        await this.cache.set(`gif:down:${p.name}`, true, RETENTION.failedLookup);
      }
    }
    return { items: [], next: null, provider: null, error: failure };
  }
}

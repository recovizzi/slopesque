// GIFs in the chat (openspec: chat-activity, GIF; design.md decision 19), without React: a GIF is sent as a link to
// its provider's file (each player loads it from the provider, nothing stored by us); the pages come from a
// `GifSource` (our server: KLIPY / GIPHY in a fallback chain, results kept in Redis, the keys on the server only).
// What the window shows: its recent GIFs, its two columns, its status line (tested in model.test.ts).
import type { GifRef } from '@slopesque/shared';

/** A GIF: the provider's id and file (a URL loaded by each player), its size. */
export type Gif = GifRef;
export type GifError = 'no-key' | 'refused' | 'down';
export interface GifPage {
  items: Gif[];
  hasNext: boolean;
  provider: string | null;
  error?: GifError | null;
}
export interface GifSource {
  trending(page: number): Promise<GifPage>;
  search(q: string, page: number): Promise<GifPage>;
}
export type GifTab = 'trending' | 'recent' | 'favorites';

export const SEARCH_DELAY = 400; // ms without typing before a search is sent
export const MIN_QUERY = 2;
export const MAX_RECENT = 50;
export const LOAD_AHEAD = 300; // px from the bottom of the list: the next page is asked for

/** Recent GIFs: the one sent goes first, once, MAX_RECENT at most. */
export const pushRecentGif = (list: Gif[], g: Gif) => [g, ...list.filter(x => x.id !== g.id)].slice(0, MAX_RECENT);

/** What is searched: a query of MIN_QUERY characters or more, else none (Tendances). */
export const queryOf = (typed: string) => {
  const v = typed.trim();
  return v.length >= MIN_QUERY ? v : '';
};

/** The list is near its end: the next page is asked for. */
export const nearEnd = (el: { scrollTop: number; clientHeight: number; scrollHeight: number }) =>
  el.scrollTop + el.clientHeight >= el.scrollHeight - LOAD_AHEAD;

const GAP = 0.035; // the gap between two GIFs of a column, in widths of the column
/** The GIFs in two columns, each in the shorter one (heights from their sizes): a new page never moves the others. */
export function gifColumns(items: Gif[], n = 2): Gif[][] {
  const cols = Array.from({ length: n }, () => [] as Gif[]),
    h = Array.from({ length: n }, () => 0);
  for (const g of items) {
    const i = h.indexOf(Math.min(...h));
    cols[i]!.push(g);
    h[i]! += (g.w > 0 ? g.h / g.w : 1) + GAP;
  }
  return cols;
}

const WHY: Record<GifError, string> = {
  'no-key': "GIF indisponibles : aucune clé n'est configurée sur le serveur.",
  refused: 'Le service de GIF refuse la clé du serveur.',
  down: 'Le service de GIF ne répond pas : réessaie plus tard.',
};

/** The line under the GIFs: loading, why there are none, the end of the results (empty: nothing to say). */
export function gifStatus(s: {
  tab: GifTab;
  query: string;
  count: number;
  loading: boolean;
  hasNext: boolean;
  error: GifError | null;
}) {
  if (s.tab === 'recent') return s.count ? '' : "Aucun GIF envoyé pour l'instant.";
  if (s.tab === 'favorites') return s.count ? '' : "Aucun favori : touche l'étoile d'un GIF pour le garder ici.";
  if (s.loading) return 'Chargement…';
  if (s.error) return WHY[s.error];
  if (s.count) return s.hasNext ? '' : 'Plus de résultats.';
  return s.query ? `Aucun GIF pour « ${s.query} ».` : 'Aucun GIF.';
}

/** Who gives the GIFs (KLIPY's ad-supported key shown as KLIPY). */
export const gifCredit = (provider: string | null) => (provider ? `GIF via ${provider.replace('-PUB', '')}` : '');

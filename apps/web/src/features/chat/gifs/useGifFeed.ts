// The pages of the GIF window: the tab shown, the search (Tendances, or Résultats while there is a query), the GIFs
// loaded page by page while scrolling (and until the window is full). A newer list makes older answers useless.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LOAD_AHEAD, nearEnd, queryOf, type Gif, type GifError, type GifSource, type GifTab } from './model';

interface Feed {
  items: Gif[];
  hasNext: boolean;
  loading: boolean;
  provider: string | null;
  error: GifError | null;
}
const fresh = (tab: GifTab): Feed => ({
  items: [],
  hasNext: false,
  loading: tab === 'trending',
  provider: null,
  error: null,
});

export function useGifFeed(source: GifSource, start: GifTab) {
  const [view, setView] = useState({ tab: start, query: '', n: 0 }); // n: the list again from its start
  const [feed, setFeed] = useState(() => fresh(start));
  const gridRef = useRef<HTMLDivElement>(null);
  const shown = useRef(view),
    run = useRef(0),
    page = useRef(0),
    busy = useRef(false),
    next = useRef(false);
  useLayoutEffect(() => {
    shown.current = view;
  });

  /** The next page of Tendances / Résultats, when the end of the list comes near (the first one at once). */
  const more = useCallback(async () => {
    const v = shown.current,
      grid = gridRef.current;
    if (v.tab !== 'trending' || busy.current || !next.current) return;
    if (page.current > 0 && grid && !nearEnd(grid)) return;
    const r = run.current;
    busy.current = true;
    setFeed(f => ({ ...f, loading: true }));
    const res = await (v.query ? source.search(v.query, page.current) : source.trending(page.current));
    if (r !== run.current) return; // another search or tab since
    busy.current = false;
    page.current++;
    next.current = res.hasNext;
    setFeed(f => ({
      items: [...f.items, ...res.items],
      hasNext: res.hasNext,
      loading: false,
      provider: res.provider ?? f.provider,
      error: res.error ?? null,
    }));
  }, [source]);

  useEffect(() => {
    run.current++;
    page.current = 0;
    busy.current = false;
    next.current = view.tab === 'trending';
    setFeed(fresh(view.tab));
    if (gridRef.current) gridRef.current.scrollTop = 0;
    void more();
    return () => {
      run.current++;
    };
  }, [view, more]);

  useEffect(() => {
    // a page added: the window not full yet, the next one
    const g = gridRef.current;
    if (g && next.current && !busy.current && g.scrollHeight <= g.clientHeight + LOAD_AHEAD) void more();
  }, [feed.items, more]);

  return {
    ...feed,
    tab: view.tab,
    query: view.query,
    gridRef,
    more,
    show: (tab: GifTab) => setView(v => ({ ...v, tab, n: v.n + 1 })),
    /** What is typed (sent SEARCH_DELAY after the last key, or on Entrée): Résultats, or Tendances again. */
    search: (typed: string) => {
      if (typed.trim() === shown.current.query) return;
      setView(v => ({ tab: 'trending', query: queryOf(typed), n: v.n + 1 }));
    },
  };
}

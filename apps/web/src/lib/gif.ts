// GIFs in the chat: a floating window (search, Tendances / Résultats, Récents, Favoris), results loaded by pages while
// scrolling, a GIF sent as a link to the provider's file (each player loads it from the provider, nothing stored by
// us). The provider is reached through `GifSource`: our server (KLIPY / GIPHY in a fallback chain, results kept in
// Redis, the keys on the server only). Without a key, a refused key or no answer, the window says which.
// See openspec/changes/define-game-concept/specs/chat-activity/spec.md (GIF) and design.md (decision 19).
import { esc } from './html';
import { icon } from './icons';

/** A GIF: the provider's id and file (a URL loaded by each player), its size. */
export interface Gif { id: string; provider: string; url: string; w: number; h: number; title: string }
export interface GifPage { items: Gif[]; hasNext: boolean; provider: string | null; error?: 'no-key' | 'refused' | 'down' | null }
export interface GifSource {
  trending(page: number): Promise<GifPage>;
  search(q: string, page: number): Promise<GifPage>;
  readonly requests: number;   // sent to the provider (the demo counts them: debounce and buffer at work)
}

export const PER_PAGE = 24;
export const SEARCH_DELAY = 400;   // ms without typing before a search is sent
export const MIN_QUERY = 2;
export const MAX_RECENT = 50, MAX_FAVORITES = 500;
const LOAD_AHEAD = 300;            // px from the bottom of the list: the next page is asked for

/** Recent GIFs: the one sent goes first, once, MAX_RECENT at most. */
export const useGif = (list: Gif[], g: Gif) => [g, ...list.filter(x => x.id !== g.id)].slice(0, MAX_RECENT);

type Tab = 'trending' | 'recent' | 'favorites';
export interface GifLists { recent: () => Gif[]; favorites: () => Gif[]; toggleFavorite: (g: Gif) => void }

/** The GIF window, next to the chat's "+": a search field (sent SEARCH_DELAY after the last key), the tabs, a grid in
 *  two columns (each GIF in the shorter one, so a new page doesn't move the others) loaded by pages while scrolling.
 *  Opens on Récents when there are some, else on Tendances. A click sends the GIF; the star keeps it in Favoris. */
export class GifPop {
  readonly el: HTMLElement;
  private input: HTMLInputElement;
  private grid: HTMLElement;
  private cols: HTMLElement[];
  private status: HTMLElement;
  private tab: Tab = 'trending';
  private query = '';
  private page = 0;
  private hasNext = false;
  private loading = false;
  private run = 0;                 // a newer list makes older answers useless
  private timer = 0;
  private shown: Gif[] = [];
  private anchor: Element | null = null;
  private onPick: ((g: Gif) => void) | null = null;

  constructor(host: HTMLElement, private source: GifSource, private lists: GifLists, private place: (el: HTMLElement, anchor: Element) => void) {
    this.el = document.createElement('div');
    this.el.className = 'gif-pop';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'GIF');
    this.el.innerHTML = `<div class="gif-head"><input type="search" class="gif-search" placeholder="Rechercher un GIF" aria-label="Rechercher un GIF" autocomplete="off" spellcheck="false"></div>
      <div class="gif-tabs" role="tablist"></div>
      <div class="gif-grid" tabindex="-1"><div class="gif-cols"><div class="gif-col"></div><div class="gif-col"></div></div><p class="gif-status"></p></div>
      <p class="gif-credit"></p>`;
    this.input = this.el.querySelector('.gif-search')!;
    this.grid = this.el.querySelector('.gif-grid')!;
    this.cols = [...this.el.querySelectorAll<HTMLElement>('.gif-col')];
    this.status = this.el.querySelector('.gif-status')!;
    host.append(this.el);

    this.input.addEventListener('input', () => {
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.setQuery(this.input.value), SEARCH_DELAY);   // no request per key
    });
    this.input.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(this.timer); this.setQuery(this.input.value); } });
    this.el.addEventListener('click', e => {
      const t = e.target as Element;
      const tab = t.closest<HTMLElement>('[data-gif-tab]');
      if (tab) { this.show(tab.dataset.gifTab as Tab); return; }
      const item = t.closest<HTMLElement>('[data-gif]');
      if (!item) return;
      const g = this.shown.find(x => x.id === item.dataset.gif);
      if (!g) return;
      if (t.closest('.gif-fav')) { this.lists.toggleFavorite(g); this.refreshStars(); if (this.tab === 'favorites') this.show('favorites'); return; }
      this.onPick?.(g);
      this.close();
    });
    this.grid.addEventListener('scroll', () => this.more());
    document.addEventListener('pointerdown', e => {
      if (this.el.hidden) return;
      const path = e.composedPath();
      if (!path.includes(this.el) && !(this.anchor && path.includes(this.anchor))) this.close();
    }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); } });
    window.addEventListener('resize', () => this.close());
  }

  get isOpen() { return !this.el.hidden; }

  open(anchor: Element, onPick: (g: Gif) => void) {
    this.anchor = anchor; this.onPick = onPick;
    this.el.hidden = false;
    this.place(this.el, anchor);
    this.input.value = ''; this.query = '';
    this.show(this.lists.recent().length ? 'recent' : 'trending');
    requestAnimationFrame(() => this.input.focus());
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    clearTimeout(this.timer);
    this.run++;
    this.anchor = this.onPick = null;
  }

  private setQuery(q: string) {
    const v = q.trim();
    if (v === this.query) return;
    this.query = v.length >= MIN_QUERY ? v : '';
    this.show('trending');   // « Résultats » while there is a query
  }

  private show(tab: Tab) {
    this.tab = tab;
    this.run++;
    this.page = 0; this.hasNext = false; this.loading = false; this.shown = [];
    for (const c of this.cols) c.replaceChildren();
    this.grid.scrollTop = 0;
    this.drawTabs();
    if (tab === 'recent' || tab === 'favorites') {
      const list = tab === 'recent' ? this.lists.recent() : this.lists.favorites();
      this.add(list);
      this.setStatus(list.length ? '' : tab === 'recent' ? 'Aucun GIF envoyé pour l\'instant.' : 'Aucun favori : touche l\'étoile d\'un GIF pour le garder ici.');
      return;
    }
    this.hasNext = true;
    void this.more();
  }

  private drawTabs() {
    const t = (id: Tab, label: string, n?: number) => `<button type="button" role="tab" data-gif-tab="${id}" aria-selected="${this.tab === id}" class="${this.tab === id ? 'on' : ''}">${label}${n ? ` <small>${n}</small>` : ''}</button>`;
    this.el.querySelector('.gif-tabs')!.innerHTML = t('trending', this.query ? 'Résultats' : 'Tendances')
      + t('recent', 'Récents', this.lists.recent().length) + t('favorites', 'Favoris', this.lists.favorites().length);
    this.el.dataset.requests = String(this.source.requests);
  }

  /** The next page, when the end of the list comes near (or the list doesn't fill the window yet). */
  private async more() {
    if (this.tab !== 'trending' || this.loading || !this.hasNext) return;
    if (this.page > 0 && this.grid.scrollTop + this.grid.clientHeight < this.grid.scrollHeight - LOAD_AHEAD) return;
    const run = this.run, q = this.query;
    this.loading = true;
    this.setStatus('Chargement…');
    const res = await (q ? this.source.search(q, this.page) : this.source.trending(this.page));
    if (run !== this.run) return;   // another search or tab since
    this.loading = false;
    this.page++;
    this.hasNext = res.hasNext;
    this.add(res.items);
    this.el.dataset.requests = String(this.source.requests);
    if (res.provider) this.el.querySelector('.gif-credit')!.textContent = `GIF via ${res.provider}`;
    const why = { 'no-key': 'GIF indisponibles : aucune clé n\'est configurée sur le serveur.', refused: 'Le service de GIF refuse la clé du serveur.', down: 'Le service de GIF ne répond pas : réessaie plus tard.' };
    this.setStatus(res.error ? why[res.error] : this.shown.length ? (res.hasNext ? '' : 'Plus de résultats.') : q ? `Aucun GIF pour « ${q} ».` : 'Aucun GIF.');
    if (this.hasNext && this.grid.scrollHeight <= this.grid.clientHeight + LOAD_AHEAD) void this.more();   // fill the window
  }

  /** Each GIF in the shorter column: what is already shown never moves. */
  private add(items: Gif[]) {
    const favs = new Set(this.lists.favorites().map(g => g.id));
    for (const g of items) {
      this.shown.push(g);
      const col = this.cols.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
      const b = document.createElement('div');
      b.className = 'gif-item';
      b.dataset.gif = g.id;
      b.innerHTML = `<button type="button" class="gif-send" title="Envoyer ${esc(g.title)}"><img src="${esc(g.url)}" width="${g.w}" height="${g.h}" alt="GIF ${esc(g.title)}" loading="lazy" draggable="false"></button>
        <button type="button" class="gif-fav ${favs.has(g.id) ? 'on' : ''}" title="${favs.has(g.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${favs.has(g.id)}">${icon.star}</button>`;
      col.append(b);
    }
  }

  private refreshStars() {
    const favs = new Set(this.lists.favorites().map(g => g.id));
    for (const it of this.el.querySelectorAll<HTMLElement>('.gif-item')) {
      const on = favs.has(it.dataset.gif!), star = it.querySelector('.gif-fav')!;
      star.classList.toggle('on', on);
      star.setAttribute('aria-pressed', String(on));
      star.setAttribute('title', on ? 'Retirer des favoris' : 'Ajouter aux favoris');
    }
    this.drawTabs();
  }

  private setStatus(s: string) { this.status.textContent = s; this.status.hidden = !s; }
}

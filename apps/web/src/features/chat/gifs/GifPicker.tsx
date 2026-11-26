// The GIF window, next to the button that opened it (the chat's « + », a poll's choice): a search field (sent
// SEARCH_DELAY after the last key), the tabs Tendances / Résultats, Récents (this device) and Favoris (my account), a
// grid in two columns loaded by pages while scrolling. Opens on Récents when there are some, else on Tendances. A
// click sends the GIF (`onPick`, then closed); the star keeps it in Favoris. Without a key, a refused key or no
// answer, it says which. Rendered only while open (its owner stops rendering it on `onClose`).
import { useEffect, useRef, useState } from 'react';
import { ServerGifs, toggleGifFavorite } from '../../../app/net';
import { useStore } from '../../../app/store';
import { cls, Icon } from '../../../design';
import { useFloating } from '../floating';
import { gifColumns, gifCredit, gifStatus, SEARCH_DELAY, type Gif, type GifSource, type GifTab } from './model';
import { useGifFeed } from './useGifFeed';

export interface GifPickerProps {
  anchor: Element;
  onPick: (g: Gif) => void;
  onClose: () => void;
  source?: GifSource;
}
const NONE: Gif[] = [];

export function GifPicker({ anchor, onPick, onClose, source: given }: GifPickerProps) {
  const ref = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    timer = useRef(0);
  const recent = useStore(s => s.device.gifRecent),
    favorites = useStore(s => s.account?.gifFavorites) ?? NONE;
  const [source] = useState(() => given ?? new ServerGifs());
  const feed = useGifFeed(source, recent.length ? 'recent' : 'trending');
  useFloating(ref, anchor, onClose, 380, 460);
  useEffect(() => {
    requestAnimationFrame(() => input.current?.focus());
    return () => clearTimeout(timer.current);
  }, []);

  const items = feed.tab === 'trending' ? feed.items : feed.tab === 'recent' ? recent : favorites;
  const status = gifStatus({ ...feed, count: items.length });
  const stars = new Set(favorites.map(g => g.id));
  const tab = (id: GifTab, label: string, n?: number) => (
    <button
      key={id}
      type="button"
      role="tab"
      data-gif-tab={id}
      aria-selected={feed.tab === id}
      className={feed.tab === id ? 'on' : ''}
      onClick={() => feed.show(id)}
    >
      {label}
      {n ? (
        <>
          {' '}
          <small>{n}</small>
        </>
      ) : null}
    </button>
  );
  const search = (v: string, now = false) => {
    clearTimeout(timer.current);
    if (now) feed.search(v);
    else timer.current = window.setTimeout(() => feed.search(v), SEARCH_DELAY); // no request per key
  };

  return (
    <div ref={ref} className="gif-pop" role="dialog" aria-label="GIF">
      <div className="gif-head">
        <input
          ref={input}
          type="search"
          className="gif-search"
          placeholder="Rechercher un GIF"
          aria-label="Rechercher un GIF"
          autoComplete="off"
          spellCheck={false}
          onChange={e => search(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(e.currentTarget.value, true)}
        />
      </div>
      <div className="gif-tabs" role="tablist">
        {tab('trending', feed.query ? 'Résultats' : 'Tendances')}
        {tab('recent', 'Récents', recent.length)}
        {tab('favorites', 'Favoris', favorites.length)}
      </div>
      <div className="gif-grid" tabIndex={-1} ref={feed.gridRef} onScroll={() => void feed.more()}>
        <div className="gif-cols">
          {gifColumns(items).map((col, i) => (
            <div key={i} className="gif-col">
              {col.map((g, j) => (
                <GifItem
                  key={`${j}:${g.id}`}
                  g={g}
                  favorite={stars.has(g.id)}
                  onSend={() => {
                    onPick(g);
                    onClose();
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="gif-status" hidden={!status}>
          {status}
        </p>
      </div>
      <p className="gif-credit">{gifCredit(feed.provider)}</p>
    </div>
  );
}

function GifItem({ g, favorite, onSend }: { g: Gif; favorite: boolean; onSend: () => void }) {
  return (
    <div className="gif-item" data-gif={g.id}>
      <button type="button" className="gif-send" title={`Envoyer ${g.title}`} onClick={onSend}>
        <img src={g.url} width={g.w} height={g.h} alt={`GIF ${g.title}`} loading="lazy" draggable={false} />
      </button>
      <button
        type="button"
        className={cls('gif-fav', favorite && 'on')}
        title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        aria-pressed={favorite}
        onClick={() => toggleGifFavorite(g)}
      >
        <Icon name="star" />
      </button>
    </div>
  );
}

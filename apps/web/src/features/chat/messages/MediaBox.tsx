// A picture in a message (openspec: chat-activity, data-retention): gone (a chat image after a week, a sticker removed
// from the room's library), or the picture at its size known before it loads (no jump); a GIF, loaded once from its
// provider and kept on this device (lib/gif-cache.ts), has its badge and a star for my favourites.
import { useEffect, useState, type CSSProperties } from 'react';
import type { GifRef, MediaView } from '@slopesque/shared';
import { cls, Icon } from '../../../design';
import { localGif } from '../../../lib/gif-cache';

const ALT = { sticker: 'Sticker', image: 'Image', gif: 'GIF' };

export function MediaBox({ m, favorite, onStar }: { m: MediaView; favorite: boolean; onStar: (g: GifRef) => void }) {
  const [kept, setKept] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    if (m.kind === 'gif' && m.src)
      void localGif(m.src).then(u => {
        if (on) setKept(u);
      });
    return () => {
      on = false;
    };
  }, [m.kind, m.src]);

  if (!m.src)
    return (
      <span className="msg-expired">
        <Icon name="imageOff" />
        <span>
          {m.kind === 'sticker' ? 'Sticker plus disponible' : 'Image plus disponible'}
          <small>
            {m.kind === 'sticker'
              ? 'Il a été retiré de la bibliothèque du salon.'
              : 'Les images du chat sont gardées une semaine.'}
          </small>
        </span>
      </span>
    );
  const style = { '--w': m.w, '--h': m.h } as CSSProperties;
  const img = (
    <img
      className={`msg-${m.kind}`}
      src={kept ?? m.src}
      width={m.w}
      height={m.h}
      style={style}
      alt={ALT[m.kind]}
      loading="lazy"
      draggable={false}
    />
  );
  const gif = m.kind === 'gif' ? m.gif : null;
  if (!gif) return img;
  return (
    <span className="msg-gif-box" style={style}>
      {img}
      <span className="gif-badge" aria-hidden="true">
        GIF
      </span>
      <button
        type="button"
        className={cls('gif-fav msg-gif-fav', favorite && 'on')}
        onClick={() => onStar(gif)}
        title={favorite ? 'Retirer de mes GIF favoris' : 'Ajouter à mes GIF favoris'}
        aria-pressed={favorite}
      >
        <Icon name="star" />
      </button>
    </span>
  );
}

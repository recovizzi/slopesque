// The preview of a message's first link, read by the server (openspec: chat-activity, Aperçu des liens): a card (site,
// title, description, picture), or a video — its thumbnail and a play button, the player loaded only after a click.
import type { CSSProperties } from 'react';
import type { LinkPreview as Preview } from '@slopesque/shared';
import { cls, Icon } from '../../../design';
import { cssUrl } from '../model';

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer nofollow' } as const;

export function LinkPreview({ p, playing, onPlay }: { p: Preview; playing: boolean; onPlay: () => void }) {
  const head = (
    <>
      <span className="lp-site">
        <Icon name="link" />
        {p.site}
      </span>
      <a className="lp-title" href={p.url} {...EXTERNAL}>
        {p.title}
      </a>
    </>
  );
  if (p.kind === 'video')
    return (
      <div className="link-preview is-video">
        {head}
        {playing && p.embed ? (
          <iframe
            className="lp-player"
            src={p.embed}
            title={p.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="lp-thumb"
            style={{ '--img': cssUrl(p.image ?? '') } as CSSProperties}
            title="Lire la vidéo ici"
            aria-label={`Lire la vidéo ${p.title}`}
            onClick={onPlay}
          >
            <span className="lp-play">
              <Icon name="play" />
            </span>
          </button>
        )}
      </div>
    );
  return (
    <div className={cls('link-preview is-card', p.image && 'has-image')}>
      <div className="lp-text">
        {head}
        {p.text && <p className="lp-desc">{p.text}</p>}
      </div>
      {p.image && <img className="lp-image" src={p.image} alt="" loading="lazy" draggable={false} />}
    </div>
  );
}

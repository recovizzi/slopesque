// The chat's pieces render the markup of the HTML views they replaced (classes, attributes, text): the look and the
// e2e selectors depend on it. Differences, on purpose: React's way of writing attributes (`allowFullScreen=""`, a
// quoted `url("…")`), and the video's thumbnail without `data-action` / `data-msg` (its click is a React handler).
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import type { MemberView } from '@slopesque/shared';
import { describe, expect, test } from 'vitest';
import { Icon } from '../../../design';
import { SuggestionList, type Suggestions } from '../composer/Suggestions';
import { quoteParts } from '../model';
import { LinkPreview } from './LinkPreview';
import { MediaBox } from './MediaBox';
import { Reactions } from './Reactions';
import { QuoteText, ReplyRef } from './Reply';

const html = (e: ReactElement) => renderToStaticMarkup(e).replace(/<link rel="preload"[^>]*>/g, '');
const icon = (name: 'link' | 'play' | 'star' | 'imageOff' | 'replied') => html(<Icon name={name} />);
const none = () => {};
const custom = [{ name: 'pepe', url: 'https://cdn.test/pepe.png', by: '' }];
const pepe =
  '<img class="emoji-custom" src="https://cdn.test/pepe.png" alt=":pepe:" title=":pepe:" draggable="false"/>';

describe('LinkPreview', () => {
  const card = {
    kind: 'card' as const,
    url: 'https://fr.wikipedia.org/wiki/Tarot',
    site: 'Wikipédia',
    title: 'Tarot — Wikipédia',
    text: 'Le tarot <b>est</b> un jeu',
    image: 'https://i.test/t.png',
  };
  const head = (site: string, url: string, title: string) =>
    `<span class="lp-site">${icon('link')}${site}</span>` +
    `<a class="lp-title" href="${url}" target="_blank" rel="noopener noreferrer nofollow">${title}</a>`;

  test('a card: its site, title, description (as text) and picture', () => {
    expect(html(<LinkPreview p={card} playing={false} onPlay={none} />)).toBe(
      `<div class="link-preview is-card has-image"><div class="lp-text">${head('Wikipédia', card.url, card.title)}` +
        '<p class="lp-desc">Le tarot &lt;b&gt;est&lt;/b&gt; un jeu</p></div>' +
        '<img class="lp-image" src="https://i.test/t.png" alt="" loading="lazy" draggable="false"/></div>',
    );
    expect(html(<LinkPreview p={{ ...card, image: null, text: undefined }} playing={false} onPlay={none} />)).toBe(
      `<div class="link-preview is-card"><div class="lp-text">${head('Wikipédia', card.url, card.title)}</div></div>`,
    );
  });

  test('a video: its thumbnail and play button, then the player after a click', () => {
    const video = {
      kind: 'video' as const,
      url: 'https://youtu.be/x',
      site: 'YouTube',
      title: 'Big "Buck"',
      image: 'https://i.ytimg.com/vi/x/hq.jpg',
      embed: 'https://www.youtube-nocookie.com/embed/x?autoplay=1',
    };
    const top = `<div class="link-preview is-video">${head('YouTube', video.url, 'Big &quot;Buck&quot;')}`;
    expect(html(<LinkPreview p={video} playing={false} onPlay={none} />)).toBe(
      `${top}<button type="button" class="lp-thumb" style="--img:url(&quot;https://i.ytimg.com/vi/x/hq.jpg&quot;)" ` +
        'title="Lire la vidéo ici" aria-label="Lire la vidéo Big &quot;Buck&quot;">' +
        `<span class="lp-play">${icon('play')}</span></button></div>`,
    );
    expect(html(<LinkPreview p={video} playing onPlay={none} />)).toBe(
      `${top}<iframe class="lp-player" src="${video.embed}" title="Big &quot;Buck&quot;" ` +
        'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen="" ' +
        'referrerPolicy="strict-origin-when-cross-origin"></iframe></div>', // attribute names: any case in HTML
    );
  });
});

describe('MediaBox', () => {
  test('gone: what it was and why', () => {
    expect(html(<MediaBox m={{ kind: 'sticker', src: null, w: 0, h: 0 }} favorite={false} onStar={none} />)).toBe(
      `<span class="msg-expired">${icon('imageOff')}<span>Sticker plus disponible` +
        '<small>Il a été retiré de la bibliothèque du salon.</small></span></span>',
    );
  });

  test('a GIF: its size known before it loads, its badge, the star of my favourites', () => {
    const gif = { id: 'g', provider: 'KLIPY', url: 'https://g.test/g.gif', w: 160, h: 120, title: 'lapin' };
    expect(html(<MediaBox m={{ kind: 'gif', src: gif.url, w: 160, h: 120, gif }} favorite onStar={none} />)).toBe(
      '<span class="msg-gif-box" style="--w:160;--h:120"><img class="msg-gif" src="https://g.test/g.gif" width="160" ' +
        'height="120" style="--w:160;--h:120" alt="GIF" loading="lazy" draggable="false"/><span class="gif-badge" ' +
        'aria-hidden="true">GIF</span><button type="button" class="gif-fav msg-gif-fav on" ' +
        `title="Retirer de mes GIF favoris" aria-pressed="true">${icon('star')}</button></span>`,
    );
  });
});

describe('replies and reactions', () => {
  test('a quote: a picture said, the text with its emoji, never a link', () => {
    expect(
      html(<QuoteText parts={quoteParts({ kind: 'media', text: 'vue :pepe:', expired: true })} custom={custom} />),
    ).toBe(`📷 <i>Image expirée</i> · vue ${pepe}`);
    expect(html(<QuoteText parts={quoteParts({ kind: 'text', text: 'example.com' })} custom={custom} />)).toBe(
      'example.com',
    );
  });

  test('a quote past 30 days: « supprimé », not a button', () => {
    const q = { id: 3, from: null, text: '', kind: 'text', gone: true };
    expect(html(<ReplyRef q={q} members={new Map()} me="" custom={[]} onJump={none} onHover={none} />)).toBe(
      `<span class="reply-ref is-gone">${icon('replied')}<span class="reply-quote">` +
        '<i>Message de plus de 30 jours, supprimé</i></span></span>',
    );
  });

  test('a reaction: its emoji (a custom one as its picture), its count, who', () => {
    const members = new Map([['u2', { name: 'Hugo' } as MemberView]]);
    expect(
      html(
        <Reactions reactions={{ ':pepe:': ['u1', 'u2'] }} members={members} me="u1" custom={custom} onReact={none} />,
      ),
    ).toBe(
      '<div class="reactions"><button class="reaction mine" type="button" data-names="Toi, Hugo" aria-pressed="true" ' +
        `aria-label=":pepe: : 2 réactions"><span>${pepe}</span><b>2</b></button></div>`,
    );
  });
});

describe('suggestions', () => {
  const list = (items: Suggestions['shown']): Suggestions => ({
    shown: items,
    isOpen: !!items,
    current: undefined,
    show: none,
    hide: none,
    move: none,
  });
  test('closed: an empty hidden list', () => {
    expect(html(<SuggestionList list={list(null)} onChoose={none} />)).toBe(
      '<ul class="emoji-suggest" role="listbox" hidden=""></ul>',
    );
  });

  test('a command, an argument, an emoji, the chosen one marked', () => {
    const items = [
      { code: 'hote', cmd: "devenir l'hôte" },
      { code: 'Hugo', cmd: 'joueur', arg: true },
      { code: 'rire', emoji: '😂' },
    ];
    expect(html(<SuggestionList list={list({ items, index: 2, style: {} })} onChoose={none} />)).toBe(
      '<ul class="emoji-suggest" role="listbox">' +
        '<li role="option" class="" aria-selected="false"><span class="sg-code">/hote</span>' +
        '<span class="sg-hint">devenir l&#x27;hôte</span></li>' +
        '<li role="option" class="" aria-selected="false"><span class="sg-code">Hugo</span><span class="sg-hint">joueur</span></li>' +
        '<li role="option" class="on" aria-selected="true"><span class="sg-emoji">😂</span><span class="sg-code">:rire:</span></li></ul>',
    );
  });
});

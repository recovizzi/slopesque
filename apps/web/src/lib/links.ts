// Links in the chat: a text followed by a dot and a known domain extension (« fr.wikipedia.org/wiki/Tarot »), or an
// address with http(s)://, becomes a link (its own look, opened in a new tab). Under a message, the first link may
// get a preview, when the site gives one: a card (site, title, description, picture) or a video, played in place
// after a click. MOCKUP: the previews come from a small local table and a rule for YouTube; in V1 the server reads
// the page (Open Graph, oEmbed) and keeps the preview.
// See openspec/changes/define-game-concept/specs/chat-activity/spec.md (Liens dans les messages, Aperçu des liens).
import { esc } from './html';
import { icon } from './icons';

/** The usual domain extensions (V1: the whole IANA list). Without http(s)://, only these make a link: « photo.png »
 *  or « M.Dupont » stay text. */
const TLDS = new Set(('com net org fr io dev app gg tv be ch ca eu co uk de es it nl pt pl se no fi dk at cz ie lu mc re '
  + 'me info xyz ai so ly to fm us jp cn ru br in au nz ma tn dz sn ci cm qc biz pro edu gov int link page site online '
  + 'store shop tech art games fun blog news wiki live social world cloud studio media email one top club lol zone '
  + 'network digital space today video music radio tools team works agency gratis paris bzh alsace corsica').split(' '));

const LINK = /(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24})(?::\d{2,5})?(?:[/?#][^\s<>"]*)?/gi;
const TRAIL = /[.,;:!?…»"')\]]+$/;

export interface Found { start: number; end: number; text: string; href: string }

/** The links of a text: where, as written, and their address (https:// added when missing). */
export function findLinks(text: string): Found[] {
  const out: Found[] = [];
  for (const m of text.matchAll(LINK)) {
    let t = m[0];
    const start = m.index!, before = text[start - 1];
    if (before && /[@\w.\-/]/.test(before)) continue;   // an e-mail, or inside a word
    const scheme = /^https?:\/\//i.test(t);
    const host = t.replace(/^https?:\/\//i, '').split(/[/?#:]/)[0];
    if (!scheme && !TLDS.has(host.split('.').pop()!.toLowerCase())) continue;
    // a dot, a comma or a closing bracket that ends the sentence isn't part of the link (a bracket opened in it is)
    let cut = t.match(TRAIL)?.[0] ?? '';
    while (cut.startsWith(')') && (t.slice(0, t.length - cut.length).match(/\(/g)?.length ?? 0) > (t.slice(0, t.length - cut.length).match(/\)/g)?.length ?? 0)) cut = cut.slice(1);
    t = t.slice(0, t.length - cut.length);
    if (!t.includes('.')) continue;
    out.push({ start, end: start + t.length, text: t, href: scheme ? t : `https://${t}` });
  }
  return out;
}

/** A message's text as HTML: the links as links, the rest through `rest` (escaped, emoji codes…). */
export function linkify(text: string, rest: (s: string) => string): string {
  let html = '', at = 0;
  for (const l of findLinks(text)) {
    html += rest(text.slice(at, l.start));
    html += `<a class="msg-link" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer nofollow" title="${esc(l.href)}">${esc(l.text)}</a>`;
    at = l.end;
  }
  return html + rest(text.slice(at));
}

// ------------------------------------------------------------------ previews
export interface Preview {
  kind: 'card' | 'video';
  url: string;
  site: string;
  title: string;
  text?: string;
  image?: string;     // card: a picture; video: its thumbnail
  embed?: string;     // video: the player's address, loaded only after a click
}

/** A YouTube address → its video id. */
export function youtubeId(href: string): string | null {
  try {
    const u = new URL(href), h = u.hostname.replace(/^(www|m)\./, '');
    if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (h === 'youtube.com' || h === 'music.youtube.com') return u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null;
  } catch { /* not an address */ }
  return null;
}

// MOCKUP: what the server would have read on these pages (its picture drawn here, no request)
const WIKI_ART = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#f3f1ea"/><g transform="rotate(-10 80 80)"><rect x="40" y="30" width="56" height="86" rx="6" fill="#fff" stroke="#1c1b19" stroke-opacity=".3" stroke-width="2"/><text x="68" y="84" font-size="30" text-anchor="middle" font-family="serif" fill="#1c1b19">21</text></g><g transform="rotate(8 96 86)"><rect x="70" y="44" width="56" height="86" rx="6" fill="#fff" stroke="#1c1b19" stroke-opacity=".3" stroke-width="2"/><text x="98" y="98" font-size="30" text-anchor="middle" fill="#d93d42">♥</text></g></svg>')}`;
const DEMO: Record<string, Omit<Preview, 'url'>> = {
  'fr.wikipedia.org/wiki/Tarot': { kind: 'card', site: 'Wikipédia', title: 'Tarot — Wikipédia', text: 'Le tarot est un jeu de cartes traditionnel, joué à trois, quatre ou cinq joueurs avec un jeu de 78 cartes : 56 cartes de couleur, 21 atouts et l\'Excuse.', image: WIKI_ART },
};
const VIDEO_TITLES: Record<string, string> = { 'aqz-KE-bpKQ': 'Big Buck Bunny 60fps 4K — Official Blender Foundation Short Film' };

/** The preview of a link, if its site gives one (MOCKUP: the table above, and any YouTube video). */
export function previewOf(href: string): Preview | null {
  const id = youtubeId(href);
  if (id) return { kind: 'video', url: href, site: 'YouTube', title: VIDEO_TITLES[id] ?? 'Vidéo YouTube', image: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`, embed: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1` };
  const key = href.replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/[/#?]+$/, '');
  const d = DEMO[key];
  return d ? { url: href, ...d } : null;
}

/** The preview under a message: a card, or a video (its thumbnail and a play button; the player after a click). */
export function previewHtml(p: Preview, msg: number, playing: boolean) {
  const head = `<span class="lp-site">${icon.link}${esc(p.site)}</span><a class="lp-title" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(p.title)}</a>`;
  if (p.kind === 'video') {
    const player = playing && p.embed
      ? `<iframe class="lp-player" src="${esc(p.embed)}" title="${esc(p.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : `<button type="button" class="lp-thumb" data-action="link-play" data-msg="${msg}" style="--img:url('${esc(p.image ?? '')}')" title="Lire la vidéo ici" aria-label="Lire la vidéo ${esc(p.title)}"><span class="lp-play">${icon.play}</span></button>`;
    return `<div class="link-preview is-video">${head}${player}</div>`;
  }
  return `<div class="link-preview is-card ${p.image ? 'has-image' : ''}"><div class="lp-text">${head}${p.text ? `<p class="lp-desc">${esc(p.text)}</p>` : ''}</div>
    ${p.image ? `<img class="lp-image" src="${esc(p.image)}" alt="" loading="lazy" draggable="false">` : ''}</div>`;
}

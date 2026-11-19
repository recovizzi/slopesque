// Links in a message (openspec: chat-activity, Liens dans les messages): where they are, their address; a YouTube video's id.
// Used by the app (to draw them) and the server (to read the first one's preview).

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

/** A YouTube address → its video id. */
export function youtubeId(href: string): string | null {
  try {
    const u = new URL(href), h = u.hostname.replace(/^(www|m)\./, '');
    if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (h === 'youtube.com' || h === 'music.youtube.com') return u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null;
  } catch { /* not an address */ }
  return null;
}


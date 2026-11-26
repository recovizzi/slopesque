// A message's text as segments, for <RichText> (design/RichText.tsx) — never as HTML: plain text (rendered as text by
// React, « <b> » included), links (findLinks: a known domain or http(s)://), the room's custom emoji (`:name:`, shown
// as their picture) and, when a lookup is given, standard emoji still written as a `:code:` (`:rire:` → 😂).
// The order of the old HTML helpers is kept (links first, then the emoji in the text between them).
import { findLinks } from './links';

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'emoji'; text: string; code: string }
  | { kind: 'custom'; name: string; url: string };

export interface RichOptions {
  /** The room's custom emoji. */
  custom?: readonly { name: string; url: string }[];
  /** Links found and made clickable (default true; false for a reaction, a quote…). */
  links?: boolean;
  /** A standard emoji's `:code:` → the emoji (lib/emoji.ts, once its codes are loaded). */
  codes?: (code: string) => string | undefined;
}

const CUSTOM = /:([a-z0-9_]{2,24}):/g; // a custom emoji's name (lib/emoji.ts NAME)
const CODE = /:([a-z0-9_+-]{1,40}):/g; // a standard emoji's code

/** `re`'s matches in `text` that `pick` turns into a segment; the rest stays text (a match not picked too). */
function scan(
  text: string,
  re: RegExp,
  pick: (m: RegExpMatchArray) => Segment | null,
  out: Segment[],
  rest: (t: string) => void,
) {
  let at = 0;
  for (const m of text.matchAll(re)) {
    const s = pick(m);
    if (!s) continue;
    if (m.index! > at) rest(text.slice(at, m.index));
    out.push(s);
    at = m.index! + m[0].length;
  }
  if (at < text.length) rest(text.slice(at));
}

export function parseRich(text: string, o: RichOptions = {}): Segment[] {
  const out: Segment[] = [];
  const byName = new Map((o.custom ?? []).map(c => [c.name, c]));
  const plain = (t: string) => {
    const last = out.at(-1);
    if (last?.kind === 'text') last.text += t;
    else out.push({ kind: 'text', text: t });
  };
  const codes = (t: string) =>
    o.codes
      ? scan(
          t,
          CODE,
          m => {
            const e = o.codes!(m[1]!);
            return e ? { kind: 'emoji', text: e, code: m[1]! } : null;
          },
          out,
          plain,
        )
      : plain(t);
  const emoji = (t: string) =>
    byName.size
      ? scan(
          t,
          CUSTOM,
          m => {
            const c = byName.get(m[1]!);
            return c ? { kind: 'custom', name: c.name, url: c.url } : null;
          },
          out,
          codes,
        )
      : codes(t);
  if (o.links === false) {
    emoji(text);
    return out;
  }
  let at = 0;
  for (const l of findLinks(text)) {
    if (l.start > at) emoji(text.slice(at, l.start));
    out.push({ kind: 'link', text: l.text, href: l.href });
    at = l.end;
  }
  if (at < text.length) emoji(text.slice(at));
  return out;
}

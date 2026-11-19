// Link previews (openspec: chat-activity, Aperçu des liens): the first link of a message, read once by the server
// (Open Graph, a YouTube video through oEmbed), kept 7 days in Redis, its image stored as a « preview » picture (7 days):
// no player contacts the site before clicking. One reading at a time per link; a site without preview: nothing.
import { Injectable, Logger } from '@nestjs/common';
import { findLinks, youtubeId } from '@slopesque/engines';
import { RETENTION, type LinkPreview } from '@slopesque/shared';
import { CacheService } from '../cache/cache.service.js';
import { MediaService } from '../media/media.service.js';
import { safeFetch } from './safe-fetch.js';

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, '\'')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).trim();

/** The meta tags of a page's head: og:*, twitter:*, the title. */
function metas(html: string) {
  const head = html.slice(0, 300_000), out: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0];
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && content !== undefined && !(key in out)) out[key] = decode(content);
  }
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1];
  if (title) out.title = decode(title);
  return out;
}

@Injectable()
export class PreviewService {
  private readonly log = new Logger('Aperçus');
  private readonly reading = new Map<string, Promise<LinkPreview | null>>();

  constructor(private readonly cache: CacheService, private readonly media: MediaService) {}

  /** The preview of a message's first link, or null. */
  async forText(text: string): Promise<LinkPreview | null> {
    const first = findLinks(text)[0];
    if (!first) return null;
    const key = `preview:${first.href}`;
    const hit = await this.cache.get<{ p: LinkPreview | null }>(key);
    if (hit) return hit.p;
    let p = this.reading.get(first.href);
    if (!p) {
      p = this.read(first.href).catch(e => { this.log.warn(`${first.href} : ${(e as Error).message}`); return null; });
      this.reading.set(first.href, p);
      void p.finally(() => this.reading.delete(first.href));
    }
    const result = await p;
    await this.cache.set(key, { p: result }, result ? RETENTION.linkPreviews : RETENTION.failedLookup);
    return result;
  }

  private async read(href: string): Promise<LinkPreview | null> {
    const yt = youtubeId(href);
    if (yt) {
      const o = await safeFetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url: `https://www.youtube.com/watch?v=${yt}`, format: 'json' })}`, { maxBytes: 64_000, accept: 'application/json' });
      let title = 'Vidéo YouTube';
      try { if (o) title = JSON.parse(o.body.toString('utf8')).title || title; } catch { /* keep the default */ }
      return { kind: 'video', url: href, site: 'YouTube', title, image: await this.image(`https://i.ytimg.com/vi/${encodeURIComponent(yt)}/hqdefault.jpg`),
        embed: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?autoplay=1` };
    }
    const page = await safeFetch(href, { maxBytes: 1_000_000, accept: 'text/html,application/xhtml+xml' });
    if (!page || !/html/i.test(page.type)) return null;
    const m = metas(page.body.toString('utf8'));
    const title = m['og:title'] ?? m['twitter:title'] ?? m.title;
    if (!title) return null;
    const imageUrl = m['og:image'] ?? m['twitter:image'];
    return { kind: 'card', url: href, site: m['og:site_name'] ?? new URL(page.url).hostname.replace(/^www\./, ''), title: title.slice(0, 200),
      text: (m['og:description'] ?? m['twitter:description'] ?? m.description)?.slice(0, 300), image: imageUrl ? await this.image(new URL(imageUrl, page.url).toString()) : null };
  }

  /** A preview's image, stored by us (no player loads it from the site). */
  private async image(url: string) {
    const r = await safeFetch(url, { maxBytes: 5_000_000, accept: 'image/*', timeoutMs: 4000 });
    if (!r || !/^image\//i.test(r.type)) return null;
    try { return this.media.url((await this.media.store('preview', r.body)).id); } catch { return null; }
  }
}

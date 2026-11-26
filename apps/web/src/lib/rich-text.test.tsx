import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { RichText } from '../design/RichText';
import { esc } from '../legacy/html';
import { withCustom } from './emoji';
import { linkify } from './links';
import { parseRich } from './rich-text';

const custom = [
  { name: 'pepe', url: 'https://cdn.test/pepe.png', by: '' },
  { name: 'ok_2', url: 'https://cdn.test/ok.png', by: '' },
];
const codes = (c: string) => (({ rire: '😂', '+1': '👍' }) as Record<string, string>)[c];

describe('parseRich', () => {
  test('plain text: one text segment, HTML kept as text', () => {
    expect(parseRich('<b>salut</b> & <i>toi</i>')).toEqual([{ kind: 'text', text: '<b>salut</b> & <i>toi</i>' }]);
  });

  test('« <b>salut</b> example.com :rire: »: the text as is, a link and the emoji (spec code-architecture)', () => {
    expect(parseRich('<b>salut</b> example.com :rire:', { codes })).toEqual([
      { kind: 'text', text: '<b>salut</b> ' },
      { kind: 'link', text: 'example.com', href: 'https://example.com' },
      { kind: 'text', text: ' ' },
      { kind: 'emoji', text: '😂', code: 'rire' },
    ]);
  });

  test('links: https:// added, end of sentence left out, e-mails and unknown domains stay text', () => {
    expect(parseRich('voir fr.wikipedia.org/wiki/Tarot. et http://x.test/a?b=1, puis a@b.com ou photo.png')).toEqual([
      { kind: 'text', text: 'voir ' },
      { kind: 'link', text: 'fr.wikipedia.org/wiki/Tarot', href: 'https://fr.wikipedia.org/wiki/Tarot' },
      { kind: 'text', text: '. et ' },
      { kind: 'link', text: 'http://x.test/a?b=1', href: 'http://x.test/a?b=1' },
      { kind: 'text', text: ', puis a@b.com ou photo.png' },
    ]);
  });

  test('custom emoji of the room; an unknown name stays text', () => {
    expect(parseRich('a :pepe: b :nope: :ok_2:', { custom })).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'custom', name: 'pepe', url: 'https://cdn.test/pepe.png' },
      { kind: 'text', text: ' b :nope: ' },
      { kind: 'custom', name: 'ok_2', url: 'https://cdn.test/ok.png' },
    ]);
  });

  test('no emoji inside a link; links off: the address stays text', () => {
    expect(parseRich('https://x.com/:pepe:/', { custom })).toEqual([
      { kind: 'link', text: 'https://x.com/:pepe:/', href: 'https://x.com/:pepe:/' },
    ]);
    expect(parseRich('example.com :pepe:', { custom, links: false })).toEqual([
      { kind: 'text', text: 'example.com ' },
      { kind: 'custom', name: 'pepe', url: 'https://cdn.test/pepe.png' },
    ]);
  });

  test('a `:code:` stays as written without the lookup, or when unknown', () => {
    expect(parseRich(':rire: :inconnu:')).toEqual([{ kind: 'text', text: ':rire: :inconnu:' }]);
    expect(parseRich(':rire::+1: :inconnu:', { codes })).toEqual([
      { kind: 'emoji', text: '😂', code: 'rire' },
      { kind: 'emoji', text: '👍', code: '+1' },
      { kind: 'text', text: ' :inconnu:' },
    ]);
  });
});

describe('RichText', () => {
  const html = (text: string, o: { links?: boolean } = {}) =>
    renderToStaticMarkup(
      <p>
        <RichText text={text} custom={custom} {...o} />
      </p>,
    ).replace(/<link rel="preload"[^>]*>/g, ''); // React's hints for the pictures, not in the DOM
  // the DOM of the HTML helpers it replaces (lib/links.ts linkify + lib/emoji.ts withCustom): same elements, same
  // attributes, same text — entities and the closing of <img> aside
  const decode = (s: string) =>
    s
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\/>/g, '>');
  test.each([
    'salut <b>toi</b> & "vous" \'eux\'',
    'regarde youtube.com/watch?v=aqz-KE-bpKQ :pepe: !',
    ':pepe::ok_2: et (voir example.org/a_(b)) :nope:',
    'https://x.com/:pepe:/ et fr.wikipedia.org/wiki/Tarot.',
  ])('same DOM as the old HTML: %s', text => {
    expect(decode(html(text))).toBe(decode(`<p>${linkify(text, t => withCustom(esc(t), custom))}</p>`));
  });

  test('player text is never HTML', () => {
    expect(html('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });
});

// A player's text, rendered by React (no HTML string): links (`.msg-link`, opened in a new tab), custom emoji
// (`.emoji-custom` pictures), standard emoji, the rest as text. The segments come from lib/rich-text.ts parseRich.
// A fragment: the caller wraps it (`<span className="msg-caption"><RichText …/></span>`).
import { Fragment } from 'react';
import { parseRich, type RichOptions } from '../lib/rich-text';

export type RichTextProps = RichOptions & { text: string };

export function RichText({ text, ...o }: RichTextProps) {
  return (
    <>
      {parseRich(text, o).map((s, i) =>
        s.kind === 'link' ? (
          <a
            key={i}
            className="msg-link"
            href={s.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={s.href}
          >
            {s.text}
          </a>
        ) : s.kind === 'custom' ? (
          <img
            key={i}
            className="emoji-custom"
            src={s.url}
            alt={`:${s.name}:`}
            title={`:${s.name}:`}
            draggable={false}
          />
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}

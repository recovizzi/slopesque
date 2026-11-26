// LEGACY (to delete in task 4.1): HTML made by our own escaping helpers (legacy/html.ts esc, lib/links.ts, lib/emoji.ts),
// never raw player text. New code renders text with React (RichText for a message's text).
/** @deprecated HTML strings go away with the conversion of each feature to React (task 4.1). */
export const Html = ({ html, as: Tag = 'span', className }: { html: string; as?: 'span' | 'div' | 'p'; className?: string }) =>
  <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

// TRANSITION (deleted in task 4.1): the GIF window opened from code, as before the chat's conversion — for
// features/poll (a choice's picture: PollWheel.tsx, useChoiceMedia.ts once task 3.1 is merged), until it renders
// <GifPicker> (features/chat/gifs/GifPicker.tsx).
// The window is the same component, rendered here into its own root (in `host`, as before).
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GifPicker } from './gifs/GifPicker';
import { pushRecentGif, type Gif, type GifSource } from './gifs/model';

export type { Gif, GifPage, GifSource } from './gifs/model';

/** @deprecated pushRecentGif (features/chat/gifs/model.ts). Still used by features/poll (a choice's GIF). */
export const useGif = pushRecentGif;

/** Not used any more: the window reads the device's recent GIFs and the account's favourites from the store. */
export interface GifLists {
  recent: () => Gif[];
  favorites: () => Gif[];
  toggleFavorite: (g: Gif) => void;
}

/** @deprecated Render <GifPicker anchor onPick onClose> (features/chat/gifs/GifPicker.tsx). Still used by
 *  features/poll (a choice's GIF). `lists` and `place` are not used any more (the window has them). */
export class GifPop {
  readonly el: HTMLElement;
  private root: Root;
  private opening: { anchor: Element; onPick: (g: Gif) => void; n: number } | null = null;
  private n = 0;

  constructor(
    host: HTMLElement,
    private source: GifSource,
    _lists?: GifLists,
    _place?: (el: HTMLElement, anchor: Element) => void,
  ) {
    this.el = document.createElement('div');
    this.el.style.display = 'contents'; // a holder only: the window is placed by itself
    host.append(this.el);
    this.root = createRoot(this.el);
  }

  get isOpen() {
    return !!this.opening;
  }

  open(anchor: Element, onPick: (g: Gif) => void) {
    this.opening = { anchor, onPick, n: ++this.n }; // each opening from its start (search, tab)
    this.render();
  }

  close() {
    if (!this.opening) return;
    this.opening = null;
    this.render();
  }

  private render() {
    const o = this.opening;
    this.root.render(
      o &&
        createElement(GifPicker, {
          key: o.n,
          anchor: o.anchor,
          source: this.source,
          onPick: o.onPick,
          onClose: () => this.close(),
        }),
    );
  }
}

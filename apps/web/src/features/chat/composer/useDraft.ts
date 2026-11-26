// The message being written: what is suggested as it is typed — the emoji of a `:co` (lib/emoji.ts suggest), the
// commands after « / », a command's arguments (lib/commands.ts) — and taken with the keyboard (↑ ↓, Entrée or Tab,
// Échap) or a click; an emoji of the picker written at the caret.
import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react';
import { useStore } from '../../../app/store';
import { argSuggestions, isComplete } from '../../../lib/commands';
import { COMMANDS, suggest, type CustomEmoji, type Suggestion } from '../../../lib/emoji';
import type { Suggestions } from './Suggestions';

export interface DraftDeps {
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
  custom: CustomEmoji[];
  suggestions: Suggestions;
  /** A command written out, taken from the suggestions: sent. */
  command: (text: string) => Promise<void>;
  /** Escape with nothing suggested: no longer a reply (true when there was one). */
  cancelReply: () => boolean;
}

export function useDraft(d: DraftDeps) {
  const sg = d.suggestions;
  /** The caret at `at` in the field, focused (after React wrote the new value). */
  const caret = (at?: number) =>
    requestAnimationFrame(() => {
      const input = d.inputRef.current;
      input?.focus();
      if (at !== undefined) input?.setSelectionRange(at, at);
    });

  function onType(v: string) {
    d.setDraft(v);
    const input = d.inputRef.current!,
      st = useStore.getState();
    const args = argSuggestions(v, st.room?.members ?? [], st.account?.id ?? '');
    if (args) return args.length ? sg.show(args, input) : sg.hide();
    const c = v.match(/^\/([a-z-]*)$/i);
    if (c) {
      const items = COMMANDS.filter(x => x.code.startsWith(c[1]!.toLowerCase()));
      if (items.length) return sg.show(items, input);
    }
    const m = v.slice(0, input.selectionStart ?? v.length).match(/(?:^|\s):([a-z0-9_+-]{2,})$/);
    if (m) {
      const items = suggest(m[1]!, d.custom);
      if (items.length) return sg.show(items, input);
    }
    sg.hide();
  }

  /** A suggestion taken: an argument (the message so far, then what can follow it), a command, or an emoji's code. */
  function complete(s: Suggestion) {
    const draft = d.draft,
      at = d.inputRef.current?.selectionStart ?? draft.length;
    if (s.fill !== undefined) {
      if (s.fill === draft) {
        sg.hide();
        void d.command(draft);
        return;
      }
      onType(s.fill);
      return caret(s.fill.length);
    }
    if (draft.startsWith('/')) {
      onType(`/${s.code} `);
      return caret();
    }
    const before = draft.slice(0, at).replace(/:([a-z0-9_+-]*)$/, `:${s.code}: `);
    d.setDraft(before + draft.slice(at));
    sg.hide();
    caret(before.length);
  }

  function onKey(e: KeyboardEvent) {
    const cur = sg.current,
      st = useStore.getState();
    if (sg.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        return sg.move(e.key === 'ArrowDown' ? 1 : -1);
      }
      const draft = d.draft.trim();
      // a command, or its arguments, written out: Entrée sends it
      if (e.key === 'Enter' && cur?.cmd !== undefined && !cur.arg && draft.toLowerCase() === `/${cur.code}`)
        return sg.hide();
      if (
        e.key === 'Enter' &&
        cur?.arg &&
        (cur.fill?.trim() === draft || isComplete(d.draft, st.room?.members ?? [], st.account?.id ?? ''))
      )
        return sg.hide();
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (cur) complete(cur);
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        return sg.hide();
      }
    }
    if (e.key === 'Escape' && d.cancelReply()) e.stopPropagation();
  }

  /** An emoji from the picker: at the caret (replacing the selection), the caret after it. */
  function insert(emoji: string) {
    const input = d.inputRef.current!,
      v = input.value,
      a = input.selectionStart ?? v.length,
      b = input.selectionEnd ?? a;
    d.setDraft(v.slice(0, a) + emoji + v.slice(b));
    caret(a + emoji.length);
  }

  return { onType, complete, onKey, insert };
}

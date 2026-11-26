import type { MemberView, MessageView } from '@slopesque/shared';
import { describe, expect, test } from 'vitest';
import {
  cssUrl,
  fmtSize,
  freshCount,
  fullQuoteParts,
  inScope,
  lineKind,
  nearBottom,
  nearTop,
  quoteParts,
  reactionLabel,
  reactionNames,
  unreadCount,
  unreadTitle,
} from './model';

const msg = (p: Partial<MessageView>): MessageView => ({
  id: 1,
  from: 'u1',
  kind: 'text',
  text: '',
  at: 0,
  reply: null,
  reactions: {},
  ...p,
});

describe('scrolling', () => {
  test('at the bottom under 40 px from it; at the top under 40 px', () => {
    expect(nearBottom({ scrollHeight: 1000, scrollTop: 561, clientHeight: 400 })).toBe(true);
    expect(nearBottom({ scrollHeight: 1000, scrollTop: 560, clientHeight: 400 })).toBe(false);
    expect(nearTop({ scrollTop: 39 })).toBe(true);
    expect(nearTop({ scrollTop: 40 })).toBe(false);
  });

  test("the button counts the new lines shown: another session's game lines left out", () => {
    const list = [msg({ id: 4 }), msg({ id: 5, scope: 'cards:2' }), msg({ id: 6, scope: 'cards:3' }), msg({ id: 7 })];
    expect(freshCount(list, 4, 'cards:3')).toBe(2);
    expect(freshCount(list, 0, null)).toBe(2);
    expect(inScope(list[2]!, 'cards:3')).toBe(true);
  });

  test('its title and its count', () => {
    expect(unreadTitle(0)).toBe('Revenir en bas du chat');
    expect(unreadTitle(1)).toBe('1 nouveau message : revenir en bas');
    expect(unreadTitle(3)).toBe('3 nouveaux messages : revenir en bas');
    expect(unreadCount(12)).toBe('12');
    expect(unreadCount(100)).toBe('99+');
  });
});

describe('lines', () => {
  test('a vote, a poll, a credit only with their data; the room speaks as a system line', () => {
    expect(lineKind(msg({ kind: 'vote', data: { vote: {} } }))).toBe('vote');
    expect(lineKind(msg({ kind: 'vote' }))).toBe('message');
    expect(lineKind(msg({ kind: 'poll', data: { chatPoll: {} } }))).toBe('poll');
    expect(lineKind(msg({ kind: 'credit', data: {} }))).toBe('credit');
    expect(lineKind(msg({ from: null }))).toBe('system');
    expect(lineKind(msg({ kind: 'system' }))).toBe('system');
    expect(lineKind(msg({ kind: 'media' }))).toBe('message');
  });

  test('reactions: who, « Toi » for me; their label', () => {
    const members = new Map([['u2', { name: 'Hugo' } as MemberView]]);
    expect(reactionNames(['u1', 'u2', 'u9'], members, 'u1')).toBe('Toi, Hugo, ?');
    expect(reactionLabel('😂', 1)).toBe('😂 : 1 réaction');
    expect(reactionLabel('😂', 2)).toBe('😂 : 2 réactions');
  });
});

describe('quotes', () => {
  const text = (t: string) => ({ kind: 'text', text: t });
  const plain = (t: string) => ({ kind: 'plain', text: t });
  test('a text as is; a picture said, with its text', () => {
    expect(quoteParts({ kind: 'text', text: 'salut' })).toEqual([text('salut')]);
    expect(quoteParts({ kind: 'media', text: '' })).toEqual([plain('📷 Image')]);
    expect(quoteParts({ kind: 'image', text: 'la vue' })).toEqual([plain('📷 '), text('la vue')]);
    expect(quoteParts({ kind: 'gif', text: '' })).toEqual([plain('GIF')]);
    expect(quoteParts({ kind: 'sticker', text: 'bravo' })).toEqual([plain('Sticker'), plain(' · '), text('bravo')]);
  });

  test('an image past its week: « Image expirée »', () => {
    expect(quoteParts({ kind: 'media', text: 'vue', expired: true })).toEqual([
      plain('📷 '),
      { kind: 'em', text: 'Image expirée' },
      plain(' · '),
      text('vue'),
    ]);
  });

  test('the bubble: a text whole, even marked expired; a picture as in a quote', () => {
    expect(fullQuoteParts({ kind: 'text', text: 'a', expired: true })).toEqual([text('a')]);
    expect(fullQuoteParts({ kind: 'sticker', text: '' })).toEqual([plain('Sticker')]);
  });
});

describe('formats', () => {
  test('sizes in Ko and Mo', () => {
    expect(fmtSize(10)).toBe('1 Ko');
    expect(fmtSize(300 * 1024)).toBe('300 Ko');
    expect(fmtSize(2.5 * 1024 * 1024)).toBe('2,5 Mo');
  });

  test('a picture in a CSS url(): quoted, never closed early', () => {
    expect(cssUrl('https://i.test/a.jpg')).toBe('url("https://i.test/a.jpg")');
    expect(cssUrl('https://i.test/a").jpg')).toBe('url("https://i.test/a\\").jpg")');
    expect(cssUrl('a\\b\nc')).toBe('url("a\\\\b\\a c")');
  });
});

import { describe, expect, test } from 'vitest';
import { bubbleAt, floatingBox } from './floating';

const view = { width: 800, height: 600 };

describe('floatingBox', () => {
  test('above its button when there is room, its right edge on the button', () => {
    expect(floatingBox({ top: 500, bottom: 532, right: 700 }, view)).toEqual({
      top: 500 - 380 - 6,
      left: 700 - 352,
      width: 352,
      height: 380,
    });
  });

  test('below when there is no room above; as high as it fits when there is room nowhere', () => {
    expect(floatingBox({ top: 40, bottom: 72, right: 400 }, view).top).toBe(78);
    expect(floatingBox({ top: 300, bottom: 332, right: 400 }, view, 352, 380).top).toBe(600 - 380 - 8);
  });

  test('inside the view: never past its left edge, smaller than a narrow view', () => {
    expect(floatingBox({ top: 500, bottom: 532, right: 100 }, view).left).toBe(8);
    expect(floatingBox({ top: 500, bottom: 532, right: 300 }, { width: 320, height: 600 }, 380, 460)).toMatchObject({
      width: 304,
      left: 8,
    });
  });
});

describe('bubbleAt', () => {
  const target = { top: 200, bottom: 220, left: 100, right: 160, width: 60 };
  test('above, on its left edge or centred', () => {
    expect(bubbleAt(target, { width: 120, height: 40 }, 800, false)).toEqual({ left: 100, top: 154 });
    expect(bubbleAt(target, { width: 120, height: 40 }, 800, true)).toEqual({ left: 70, top: 154 });
  });

  test('below near the top of the view; kept 4 px inside its sides', () => {
    expect(bubbleAt({ ...target, top: 20, bottom: 40 }, { width: 120, height: 40 }, 800, false).top).toBe(46);
    expect(bubbleAt({ ...target, left: 780, right: 800 }, { width: 120, height: 40 }, 800, false).left).toBe(676);
    expect(bubbleAt({ ...target, left: 0, right: 20, width: 20 }, { width: 120, height: 40 }, 800, true).left).toBe(4);
  });
});

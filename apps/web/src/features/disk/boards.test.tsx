// The boards keep the markup the CSS (disk.css) and the e2e rely on: `.board` hidden by its attribute, the rays'
// classes, the seats' numbers and classes, what may be picked.
import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AmphiBoard } from './AmphiBoard';
import { DiskBoard } from './DiskBoard';
import type { Ray } from './model';

const noop = () => {};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('DiskBoard', () => {
  const rays: Ray[] = [
    { id: 'target', value: 50, color: 'c0', kind: 'target', label: 'Hugo (hôte)' },
    { id: 'a', value: 20, color: 'c1', kind: 'player', label: 'Léa <b>' },
    { id: 'me', value: 80, color: 'c2', kind: 'mine', label: 'Toi' },
  ];

  test('a slider: focusable while I may place my ray, its value mine', () => {
    const s = html(<DiskBoard rays={rays} tolerance={3} interactive onPick={noop} />);
    expect(s).toMatch(/^<svg viewBox="0 0 240 130" class="disk board is-interactive" role="slider"/);
    expect(s).toContain('aria-valuenow="80"');
    expect(s).toContain('tabindex="0"');
    expect(s).not.toContain('hidden');
  });

  test('hidden by its attribute, not focusable when it is not my turn', () => {
    const s = html(<DiskBoard rays={[]} tolerance={3} interactive={false} hidden onPick={noop} />);
    expect(s).toMatch(/^<svg [^>]*class="disk board"[^>]*hidden=""/);
    expect(s).not.toContain('tabindex');
    expect(s).not.toContain('aria-valuenow');
  });

  test('the rays: a wedge for the target, then the players’, mine last; a name is text', () => {
    const s = html(<DiskBoard rays={rays} tolerance={3} interactive={false} onPick={noop} />);
    expect(count(s, /class="ray ray-target"/g)).toBe(1);
    expect(s.indexOf('ray-target')).toBeLessThan(s.indexOf('ray-player'));
    expect(s.indexOf('ray-player')).toBeLessThan(s.indexOf('ray-mine'));
    expect(s).toContain('<title>Léa &lt;b&gt;</title>');
    expect(s).toContain('style="--c:c2"');
    expect(count(s, /<line /g)).toBe(9 + 3); // the graduations, a line per ray
  });
});

describe('AmphiBoard', () => {
  test('175 numbered seats, what may be picked said by data-pick', () => {
    const s = html(<AmphiBoard pick="seat" column={null} marks={[]} onPick={noop} />);
    expect(count(s, /class="seat"/g)).toBe(175);
    expect(s).toContain('data-seat="174"');
    expect(s).toMatch(
      /^<svg viewBox="0 0 240 130" class="board amphi is-interactive" role="grid" aria-label="Amphithéâtre" data-pick="seat" tabindex="0"/,
    );
    expect(html(<AmphiBoard pick={null} column={null} marks={[]} hidden onPick={noop} />)).toMatch(
      /data-pick="" hidden=""/,
    );
  });

  test("the host's column as a band, the seats marked with their player's colour and name", () => {
    const s = html(
      <AmphiBoard
        pick={null}
        column={{ col: 0, color: 'hc', style: 'band' }}
        marks={[{ seat: 3, color: 'pc', kind: 'player', label: 'Léa' }]}
        onPick={noop}
      />,
    );
    expect(s).toContain('<g class="col-band" style="--hc:hc"><path d=');
    expect(count(s, /class="cap"/g)).toBe(2);
    expect(s).toContain(
      'class="seat is-col col-band is-player is-taken" data-seat="3" style="--c:pc;--hc:hc"><title>Léa</title>',
    );
    expect(count(s, /is-col col-band/g)).toBe(7);
  });
});

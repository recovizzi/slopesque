// The Roulette's views render the markup the styles and the e2e rely on (classes, data-* hooks).
import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Wheel } from './Wheel';
import { WheelEditor } from './WheelEditor';
import { WheelLegend } from './WheelLegend';

const items = [
  { label: 'Pizza', weight: '' },
  { label: 'Sushi', weight: '' },
];

describe('Wheel', () => {
  test('a sector per proposition, the winner highlighted, the needle', () => {
    const svg = html(<Wheel items={items} winner={1} spin={null} skew={0} />);
    expect(svg).toMatch(/^<svg viewBox="-4 -4 208 208" class="wheel has-winner" role="img" aria-label="Roulette">/);
    expect(svg).toContain('<g class="sector" style="--c:hsl(200 62% 62%)" data-i="0"><path d="M100 100 L100.00 10.00');
    expect(svg).toContain('<g class="sector is-winner" style="--c:hsl(338 62% 62%)" data-i="1">');
    expect(svg).toContain('<text x="42.40" y="98.00" class="sector-label">Sushi</text>');
    expect(svg).toContain('<g class="wheel-needle"><line x1="100" y1="100" x2="100" y2="20"></line>');
  });
});

describe('WheelEditor', () => {
  test('a name and a weight per proposition (the e2e fills them), each share', () => {
    const out = html(<WheelEditor items={items} onChange={() => {}} />);
    expect(out).toContain('data-wh="label" data-i="1" maxLength="30" placeholder="Proposition 2"');
    expect(out).toContain('class="weight" data-wh="weight" data-i="0"');
    expect(out).toContain('<span class="share" data-share="0">50 %</span><span class="icon-sp"></span>');
    expect(out).toContain('<button class="btn ghost sm" type="button">+ Ajouter une proposition</button>');
  });

  test('a weight that is not a number, weights above 100: said at once', () => {
    const bad = html(<WheelEditor items={[{ label: 'A', weight: 'x' }, ...items]} onChange={() => {}} />);
    expect(bad).toContain('class="weight is-bad"');
    expect(bad).toContain('<button class="icon-btn sm" type="button" title="Retirer" aria-label="Retirer">');
    const over = html(
      <WheelEditor
        items={[
          { label: 'A', weight: '80' },
          { label: 'B', weight: '30' },
        ]}
        onChange={() => {}}
      />,
    );
    expect(over).toContain('<p class="alert" role="alert">Total des poids : 110 %, au-dessus de 100.');
  });
});

describe('WheelLegend', () => {
  test('each proposition, its weight and share; the winner crowned', () => {
    const out = html(<WheelLegend items={[...items, { label: '', weight: '0' }]} winner={0} />);
    expect(out).toContain(
      '<li class="win" style="--c:hsl(200 62% 62%)"><span class="swatch"></span><span class="legend-label"><span class="crown"><svg',
    );
    expect(out).toContain('<span class="legend-label is-empty">Proposition 3</span><small>poids 0</small><b>0 %</b>');
    expect(out).toContain('<li style="--c:hsl(338 62% 62%)">');
  });

  test('an empty wheel', () => {
    expect(html(<WheelLegend items={[]} />)).toBe('<p class="poll-wait">La roue est vide pour l&#x27;instant.</p>');
  });
});

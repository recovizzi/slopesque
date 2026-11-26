// The Sondage's views render the markup the styles and the e2e rely on (classes, data-* hooks).
import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { Gradient } from './Gradient';
import { PollAnswer, type ShownPoll } from './PollAnswer';
import { PollResults, type Outcome } from './PollResults';

vi.mock('./heatmap', () => ({ heatmapUrl: (n: number) => `data:image/png;base64,heat${n}` })); // a canvas, in the panel

const pic = { kind: 'sticker' as const, src: 'https://x.test/s.webp', w: 64, h: 64 };
const choices: ShownPoll = { kind: 'choices', question: 'Ton animal ?', choices: ['Chien', ''], pics: [null, pic] };
const who = { name: (id: string) => ({ a: 'Léa', b: 'Hugo' })[id] ?? '?', color: () => 'hsl(10 50% 50%)' };
const noop = () => {};
const answer = { free: '', can: true, color: 'red', custom: [], onPick: noop, onFree: noop, onSubmit: noop };

describe('Gradient', () => {
  test('clickable only with onPick (data-gradient, focusable)', () => {
    const pick = html(<Gradient choices={['Mer', 'Montagne']} onPick={noop} />);
    expect(pick).toMatch(
      /^<svg class="gradient g1 is-pick" viewBox="0 0 300 50" data-gradient="" tabindex="0" role="img"/,
    );
    expect(html(<Gradient choices={['Mer', 'Montagne']} />)).not.toMatch(/data-gradient|tabindex/);
  });

  test('the heatmap clipped by its own shape (g-clip-<corners>)', () => {
    const svg = html(
      <Gradient
        choices={['A', 'B', 'C']}
        heat={[[0, 0]]}
        dots={[{ at: [0, 0], color: 'red', kind: 'player', names: 'Léa' }]}
      />,
    );
    expect(svg).toContain('<clipPath id="g-clip-3"><polygon points=');
    expect(svg).toContain('href="data:image/png;base64,heat3"');
    expect(svg).toContain('clip-path="url(#g-clip-3)"');
    expect(svg.match(/class="g-corner"/g)).toHaveLength(3);
    expect(svg).toContain(
      '<circle class="g-dot is-player" cx="150.0" cy="98.0" r="4.5" style="--c:red" data-names="Léa">',
    );
  });

  test('a proposition without a name, and its full name on hover', () => {
    expect(html(<Gradient choices={['Une très longue proposition', '']} />)).toContain(
      'data-label="0">Une très longue…<title>Une très longue proposition</title></text>',
    );
    expect(html(<Gradient choices={['Mer', '']} />)).toContain('data-label="1">Proposition 2<title></title>');
  });
});

describe('PollAnswer', () => {
  test('choices: my pick on, a choice that is only a picture named « Choix 2 »', () => {
    const out = html(<PollAnswer poll={choices} pick={1} {...answer} />);
    expect(out).toContain('<button type="button" class="poll-option">');
    expect(out).toContain(
      '<button type="button" class="poll-option on has-pic"><span class="option-pic"><img class="choice-img pic-sticker"',
    );
    expect(out).toContain('<i>Choix 2</i>');
    expect(html(<PollAnswer poll={choices} pick={null} {...answer} can={false} />)).toContain('disabled=""');
  });

  test('free: a field while I can answer, then my answer', () => {
    const free: ShownPoll = { kind: 'free', question: 'On mange quoi ?', choices: [], pics: [] };
    expect(html(<PollAnswer poll={free} pick={null} {...answer} free="Pizza" />)).toMatch(
      /^<input class="poll-free" data-poll="free" maxLength="60" placeholder="Ta réponse" autoComplete="off" value="Pizza"\/>$/,
    );
    expect(html(<PollAnswer poll={free} pick={null} mine="Pizza" {...answer} can={false} />)).toBe(
      '<p class="poll-mine">Ta réponse : « Pizza »</p>',
    );
  });

  test('gradient: my point, pending until validated', () => {
    const g: ShownPoll = { kind: 'gradient', question: 'Mer ou montagne ?', choices: ['Mer', 'Montagne'], pics: [] };
    expect(html(<PollAnswer poll={g} pick={[0.5, 0]} {...answer} />)).toContain(
      'class="g-dot is-pending" cx="150.0" cy="20.0" r="6"',
    );
    expect(html(<PollAnswer poll={g} pick={null} mine={[0.5, 0]} {...answer} can={false} />)).toContain(
      'g-dot is-mine',
    );
  });
});

describe('PollResults', () => {
  const out: Outcome = {
    ranked: [
      { key: '1', label: '', ids: ['a'], value: 1 },
      { key: '0', label: 'Chien', ids: [], value: 0 },
    ],
    winner: '1',
    hostEdge: false,
    tie: false,
  };
  const props = { poll: choices, answers: { a: 1 }, outcome: out, who, custom: [] };

  test('bars: the winner crowned, who gave it on hover, the pictures aligned', () => {
    const r = html(<PollResults {...props} secret={false} />);
    expect(r).toMatch(/^<div class="poll-results"><p class="note">1 réponse<\/p><ol class="poll-bars">/);
    expect(r).toContain('<li class="bar-row win" data-names="Léa"><span class="bar-label"><span class="bar-pic"><img');
    expect(r).toContain('<span class="crown" title="Numéro 1"><svg');
    expect(r).toContain('<li class="bar-row"><span class="bar-label"><span class="bar-pic empty"></span>Chien</span>');
    expect(r).toContain(
      '<span class="bar-fill" style="width:100%"></span></span><span class="bar-count">100 % · 1</span>',
    );
  });

  test('secret: nobody named', () => {
    expect(html(<PollResults {...props} secret />)).not.toContain('data-names');
  });

  test('free answers grouped (×n); a tie broken by the host said', () => {
    const free: ShownPoll = { kind: 'free', question: 'On mange quoi ?', choices: [], pics: [] };
    const r = html(
      <PollResults
        {...props}
        poll={free}
        answers={{ a: 'Pizza !', b: 'pizza' }}
        outcome={{
          ranked: [{ key: 'pizza', label: 'Pizza !', ids: ['a', 'b'], value: 2 }],
          winner: 'pizza',
          hostEdge: true,
          tie: false,
        }}
        secret={false}
      />,
    );
    expect(r).toContain('<li class="answer-card win" data-names="Léa, Hugo"><span class="crown"');
    expect(r).toContain('Pizza !<span class="mult" title="2 joueurs">×2</span></li>');
    expect(r).toMatch(/<\/div><p class="host-edge">Avantage hôte<\/p>$/);
  });

  test('gradient: the heatmap, the points of each player, the temperatures', () => {
    const g: ShownPoll = { kind: 'gradient', question: 'Mer ou montagne ?', choices: ['Mer', 'Montagne'], pics: [] };
    const r = html(
      <PollResults
        {...props}
        poll={g}
        answers={{ a: [0.8, 0] }}
        outcome={{
          ranked: [
            { key: '1', label: 'Montagne', ids: [], value: 94 },
            { key: '0', label: 'Mer', ids: [], value: 6 },
          ],
          winner: '1',
          hostEdge: false,
          tie: false,
        }}
        secret={false}
      />,
    );
    expect(r).toContain('<div class="poll-heat"><svg class="gradient g1"');
    expect(r).toContain('clip-path="url(#g-clip-2)"');
    expect(r).toContain('data-names="Léa"');
    expect(r).toContain(
      '<li class="temp win"><span class="temp-badge" style="--t:hsl(0 72% 48%)">94°</span><span class="crown"',
    );
    expect(r).toContain(
      '<li class="temp"><span class="temp-badge" style="--t:hsl(215 72% 48%)">6°</span><span>Mer</span></li>',
    );
  });
});

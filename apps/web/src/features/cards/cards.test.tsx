// The table's pieces render the markup the stylesheet, the animations and the e2e read (classes, data-*).
import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { KickButton, SeatPill } from './SeatPill';
import { CardBack, PlayingCard } from './PlayingCard';
import { MiniCard, TrumpCard } from './tarot/TarotCard';
import { suitCard, trumpCard } from './tarot/model';

describe('cards', () => {
  test('a face: red or black, its value and suit in both corners, its name said', () => {
    const svg = html(<PlayingCard value="D" suit="H" label="Dame de cœur" className="small" />);
    expect(svg).toMatch(/^<svg class="card-svg red small" viewBox="0 0 60 84" role="img" aria-label="Dame de cœur">/);
    expect(svg.match(/<text x="6" y="17" class="cv">D<\/text>/g)).toHaveLength(2);
    expect(html(<PlayingCard value="7" suit="S" label="7 de pique" />)).toContain('class="card-svg black"');
  });
  test('a back', () =>
    expect(html(<CardBack className="mini" />)).toMatch(/^<svg class="card-svg back mini"[^>]*aria-hidden="true">/));
  test("a trump: its own clip and gradient; the host's picture", () => {
    const two = html(
      <>
        <TrumpCard n={7} />
        <TrumpCard n={7} />
      </>,
    );
    const ids = [...two.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(2);
    expect(two).toContain(`clip-path="url(#${ids[0]})"`);
    const dressed = html(<TrumpCard n={0} art="https://x/excuse.png" />);
    expect(dressed).toMatch(/class="card-svg trump excuse has-art"[^>]*aria-label="L&#x27;Excuse"/);
    expect(dressed).toContain('<image href="https://x/excuse.png"');
  });
  test('a card in short', () => {
    expect(html(<MiniCard card={suitCard('H', 14)} />)).toBe(
      '<span class="mini-card red" title="Roi de cœur">R♥️</span>',
    );
    expect(html(<MiniCard card={trumpCard(0)} />)).toContain('★');
  });
});

describe('a seat', () => {
  const robot = { name: 'Biscotte', color: 'var(--cg-robot)', hue: null, bot: true, photo: null };
  test('a robot: its grey, its icon, no empty line under its name', () => {
    const li = html(<SeatPill p={robot} data-seat="s3" sub={false} />);
    expect(li).toMatch(/^<li class="cg-seat is-robot" style="--c:var\(--cg-robot\)" data-seat="s3">/);
    expect(li).toContain('<span class="seat-bot corner" title="Un robot joue cette place">');
    expect(li).not.toContain('seat-sub');
    expect(li).toContain('<span class="seat-name" title="Biscotte">Biscotte</span>');
  });
  test("a player's photo; what goes under and beside the name", () => {
    const li = html(
      <SeatPill
        p={{ ...robot, name: 'Léa', hue: 222, bot: false, photo: 'https://x/l.png' }}
        sub="passe"
        side={<b>3</b>}
      />,
    );
    expect(li).toContain('class="avatar sm has-photo"');
    expect(li).toContain('<span class="seat-sub">passe</span>');
    expect(li).toContain('<span class="seat-side"><b>3</b></span>');
  });
  test('the kick: proposed after 30 s, or the vote running', () => {
    expect(html(<KickButton late={{ secs: 31, vote: false }} onKick={() => {}} />)).toMatch(
      /^<button class="seat-kick" type="button" data-action="kick" title="Son tour dure depuis 31 s/,
    );
    expect(html(<KickButton late={{ secs: 31, vote: true }} onKick={() => {}} />)).toBe(
      '<span class="seat-kick is-vote">vote en cours</span>',
    );
    expect(html(<KickButton late={null} onKick={() => {}} />)).toBe('');
  });
});

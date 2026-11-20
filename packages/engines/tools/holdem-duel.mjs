// `pnpm holdem:duel [hands] [games]`: how strong the Hold'em's robot levels are (openspec: card-games, Robots du
// Texas Hold'em). Two measures, not in the CI (their spread needs many hands):
// 1. heads-up, « duplicate »: each hand (100 big blinds each) is played twice with the same cards, the two levels
//    swapping seats, so the luck of the cards cancels out; what the first level wins, in big blinds per 100 hands;
// 2. tournaments of 6 (500 chips, blinds up every 5 hands), 3 robots of each level on alternating seats: the
//    average place of each level (1 is the best, 3.5 is even).
// Measured on 2026-11-20 (3 000 hands, 150 games): moyen over facile +32 bb / 100, places 3.06 / 3.94; fort over moyen
// +10 to +13 bb / 100, places 3.39 / 3.61; fort over facile +77 bb / 100, places 2.89 / 4.11.
import { Holdem as H, HoldemAI as AI } from '../dist/index.js';

const hands = Number(process.argv[2] ?? 1000), games = Number(process.argv[3] ?? 60);

function playHand(g0, level) {
  const g = structuredClone(g0);
  for (let k = 0; k < 400 && g.turn; k++) H.act(g, g.turn, AI.decide(H.holdemView(g, g.turn), g.turn, level(g.turn)));
  return g;
}
function headsUp(x, y) {
  let won = 0;
  for (let i = 0; i < hands; i++) {
    const g0 = H.newGame(['a', 'b'], { stack: 2000, every: 0 });
    const one = playHand(g0, s => (s === 'a' ? x : y)), two = playHand(g0, s => (s === 'a' ? y : x));
    won += one.stacks.a - 2000 + (two.stacks.b - 2000);
  }
  return (won / 20 / (2 * hands)) * 100;   // big blinds (20) per 100 hands
}
function tournaments(x, y) {
  const places = { [x]: 0, [y]: 0 };
  for (let i = 0; i < games; i++) {
    const seats = ['s0', 's1', 's2', 's3', 's4', 's5'], level = s => ((Number(s[1]) + i) % 2 ? x : y);
    const g = H.newGame(seats, { stack: 500, every: 5 });
    for (let n = 0; n < 500 && !g.over; n++) {
      for (let k = 0; k < 400 && g.turn; k++) H.act(g, g.turn, AI.decide(H.holdemView(g, g.turn), g.turn, level(g.turn)));
      if (!g.over) H.dealHand(g);
    }
    if (!g.over) H.finish(g);
    for (const s of seats) places[level(s)] += g.places[s] / 3;
  }
  return Object.fromEntries(Object.entries(places).map(([k, v]) => [k, (v / games).toFixed(2)]));
}

for (const [x, y] of [['moyen', 'facile'], ['fort', 'moyen'], ['fort', 'facile']]) {
  const t0 = Date.now();
  const bb = headsUp(x, y), places = tournaments(x, y);
  console.log(`${x} contre ${y} : ${bb >= 0 ? '+' : ''}${bb.toFixed(1)} bb / 100 mains à deux ; place moyenne en tournoi à 6 : ${x} ${places[x]}, ${y} ${places[y]}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}

// `pnpm coinche:duel [deals]`: how strong the Coinche's robot levels are (openspec: card-games, Robots de la Coinche).
// « Duplicate »: each deal is played twice with the same cards, the two levels swapping places (team a & c, team
// b & d), the bidding included; what the first level's team scores per deal over the other's. Not in the CI.
// Measured on 2026-11-23 (200 deals): moyen over facile +13, fort over moyen +8 to +19, fort over facile +31.
import { Coinche as C, CoincheAI as AI } from '../dist/index.js';

const deals = Number(process.argv[2] ?? 300);
function playDeal(g0, level) {
  const g = structuredClone(g0);
  for (let k = 0; k < 80 && g.phase !== 'done'; k++) {
    const me = g.turn, d = AI.decide(C.coincheView(g, me), me, level(me));
    if ('say' in d) C.bid(g, me, d.say); else C.play(g, me, d.play);
  }
  return g.result ? g.result.score : [0, 0];
}
function duel(x, y) {
  let gain = 0, taken = 0, made = 0;
  for (let i = 0; i < deals; i++) {
    const g0 = C.newGame(['a', 'b', 'c', 'd']);
    g0.dealer = ['a', 'b', 'c', 'd'][i % 4]; C.dealHand(g0, false);
    const one = playDeal(g0, s => (C.team(g0, s) === 0 ? x : y)), two = playDeal(g0, s => (C.team(g0, s) === 1 ? x : y));
    gain += one[0] - one[1] + (two[1] - two[0]);
  }
  return gain / (2 * deals);
}
for (const [x, y] of [['moyen', 'facile'], ['fort', 'moyen'], ['fort', 'facile']]) {
  const t0 = Date.now(), g = duel(x, y);
  console.log(`${x} contre ${y} : ${g >= 0 ? '+' : ''}${g.toFixed(1)} points par donne  (${Math.round((Date.now() - t0) / 1000)} s)`);
}

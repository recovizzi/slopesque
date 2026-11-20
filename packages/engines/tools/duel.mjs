// `pnpm tarot:duel [deals]`: how strong the Tarot's robot levels are (openspec: card-games, Niveau des robots). The
// « duplicate » way: each deal is played twice, the two levels swapping seats, so the luck of the cards cancels out;
// what the first level gains per deal over the second. Not in the CI (its spread needs hundreds of deals).
// Measured on 2026-11-20 (about 240 deals): moyen over facile +13 to +25 per deal; fort over moyen +22 to +27 (60 deals).
import { Tarot as T, TarotAI as AI } from '../dist/index.js';

const deals = Number(process.argv[2] ?? 200);
function playDeal(t0, level) {
  const t = structuredClone(t0);
  for (let s = 0; s < 400 && t.phase !== 'done'; s++) {
    const me = t.phase === 'dog' || t.phase === 'call' ? t.taker : t.turn;
    const d = AI.decide(T.tarotView(t, me), me, level(me), Math.random, T.play);
    if ('bid' in d) T.bid(t, me, d.bid); else if ('call' in d) T.call(t, me, d.call); else if ('discard' in d) T.discard(t, d.discard);
    else { if (d.handful) T.declareHandful(t, me, d.handful); T.play(t, me, d.play); }
  }
  return t.result;
}
function duel(x, y, n) {
  let gain = 0, played = 0;
  for (let i = 0; i < n; i++) {
    const t0 = T.deal(['a', 'b', 'c', 'd'], null), pair = s => s === 'a' || s === 'c';
    const r1 = playDeal(t0, s => (pair(s) ? x : y)), r2 = playDeal(t0, s => (pair(s) ? y : x));
    if (!r1 || !r2) continue;
    played++;
    gain += r1.marks.a + r1.marks.c + r2.marks.b + r2.marks.d;
  }
  return `${x} contre ${y} : ${gain >= 0 ? '+' : ''}${Math.round(gain / played / 2)} points par donne (${played} donnes jouées deux fois)`;
}
console.log(duel('moyen', 'facile', deals));
if (!process.argv.includes('--quick')) console.log(duel('fort', 'moyen', Math.max(20, Math.round(deals / 4))));

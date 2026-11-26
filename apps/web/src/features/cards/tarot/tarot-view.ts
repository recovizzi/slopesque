// The Tarot's look: the trumps (atouts) — a white card with an inner white border, the picture inside (an image the
// host chose, or by default a coloured background with an emoji), the number in the top-left and bottom-right corners
// on a white box whose free corner is rounded and whose edges flow into the border with small concave curves — the
// suit cards (as the Trou du cul's), the table (bids, chien and écart, tricks, the count) and the rules.
// See openspec/changes/define-game-concept/specs/card-games/spec.md.
import { backSvg, faceSvg, handAngle, head, rulesFrame, seatCols, seatPill, SUIT_EMOJI } from '../cards';
import { esc } from '../../../legacy/html';
import { Tarot as TA } from '@slopesque/engines';

const { BIDS, bidsFor, callable, canDiscard, cardName, ecartSize, handfulLevels, handfulSizes, HANDFUL_NAMES, HANDFUL_POINTS, isBout, legal, NEED, suitLabel } = TA;
type Bid = TA.Bid; type Tarot = TA.Tarot; type TCard = TA.TCard; type TPlay = TA.TPlay;

/** The default dressing of the trumps: an emoji each (0: the Excuse, the jester). */
export const TRUMP_EMOJI = ['🤡', '🐣', '🎈', '🎨', '🎻', '🎪', '🌻', '🚲', '⛵', '🏰', '🎡', '🌋', '🐉', '🦁', '🦅', '🌙', '🔥', '⭐', '🌊', '☀️', '🌈', '👑'];
export const trumpLabel = (n: number) => (n === 0 ? '★' : String(n));

// The number's box, top left (the bottom-right one is the same, turned): from the inner border (I), W × H, its free
// corner rounded (R), concave curves (F) where it meets the border, so that the white flows from the border.
const I = 3.5, W = 16, H = 17, R = 5, F = 4;
const BOX = `M${I} ${I}H${I + W + F}A${F} ${F} 0 0 0 ${I + W} ${I + F}V${I + H - R}A${R} ${R} 0 0 1 ${I + W - R} ${I + H}H${I + F}A${F} ${F} 0 0 0 ${I} ${I + H + F}Z`;

/** A trump (1 … 21) or the Excuse (0): its picture (an image, or the default dressing) inside a white inner border. */
export function trumpSvg(n: number, art?: string, cls = '') {
  const hue = (210 + n * 17) % 360, label = trumpLabel(n), cx = I + W / 2, cy = I + H / 2 + 0.5;
  const picture = art
    ? `<image href="${esc(art)}" x="${I}" y="${I}" width="${60 - 2 * I}" height="${84 - 2 * I}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${I}" y="${I}" width="${60 - 2 * I}" height="${84 - 2 * I}" fill="url(#tg${n})"/><text x="30" y="45" class="temoji" text-anchor="middle">${TRUMP_EMOJI[n]}</text>`;
  return `<svg class="card-svg trump ${n === 0 ? 'excuse' : ''} ${art ? 'has-art' : ''} ${cls}" viewBox="0 0 60 84" role="img" aria-label="${n === 0 ? 'L\'Excuse' : `Atout ${n}`}">
    <defs><clipPath id="tclip"><rect x="${I}" y="${I}" width="${60 - 2 * I}" height="${84 - 2 * I}" rx="4.5"/></clipPath>
      <linearGradient id="tg${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 80%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 55% 52%)"/></linearGradient></defs>
    <rect class="tbg" x=".75" y=".75" width="58.5" height="82.5" rx="7"/>
    <g clip-path="url(#tclip)">${picture}</g>
    <rect class="tline" x="${I}" y="${I}" width="${60 - 2 * I}" height="${84 - 2 * I}" rx="4.5"/>
    <g class="corner-top"><path class="tbox" d="${BOX}"/><text class="tv" x="${cx}" y="${cy}" text-anchor="middle">${label}</text></g>
    <g class="corner-bottom" transform="rotate(180 30 42)"><path class="tbox" d="${BOX}"/><text class="tv" x="${cx}" y="${cy}" text-anchor="middle">${label}</text></g></svg>`;
}

/** Any Tarot card: a trump, the Excuse, or a suit card (1 … 10, V, C, D, R). */
export const tarotSvg = (c: TCard, art: Record<string, string> = {}, cls = '') =>
  (c.kind === 'suit' ? faceSvg(suitLabel(c.r), c.s!, cardName(c), cls) : trumpSvg(c.r, art[String(c.r)], cls));

// ------------------------------------------------------------------ the table
export interface TarotCtx {
  t: Tarot;
  me: string;
  playing: boolean;
  host: boolean;
  selected: Set<string>;
  fan: { r: number; step: number };
  who: (id: string) => { name: string; color: string; bot?: boolean; photo?: string | null };
  art: Record<string, string>;
  showLast: boolean;                  // the trick just completed, still on the table (before it goes to its winner)
  wonView: string | null;             // the player whose won tricks are shown (hovering his chip, or my pile)
  showTricks: boolean;                // the host's setting: the won tricks can be looked at (off: remember the cards)
}

/** A card in short, readable at a glance: its letter and its suit (« R ♥️ »), or a trump's number. */
export const miniCard = (c: TCard) => (c.kind === 'suit'
  ? `<span class="mini-card ${c.s === 'H' || c.s === 'D' ? 'red' : ''}" title="${esc(cardName(c))}">${suitLabel(c.r)}${SUIT_EMOJI[c.s!]}</span>`
  : `<span class="mini-card trump" title="${esc(cardName(c))}">${c.kind === 'excuse' ? '★' : c.r}</span>`);

/** The announcements over the table (app.ts shows them a moment): who takes, and at 5 the called card turned over. */
export function takeAnnounce(name: string, bid: Exclude<Bid, 'pass'>) {
  return `<div class="announce-box take"><small>Fin des enchères</small>${esc(name)} prend<span class="ann-bid">${BIDS[bid].name}</span></div>`;
}
export function callAnnounce(name: string, card: TCard, art: Record<string, string>, mine: boolean) {
  return `<div class="announce-box call"><div class="flip"><div class="flip-inner"><span class="flip-face back">${backSvg()}</span>
    <span class="flip-face front">${tarotSvg(card, art)}</span></div></div>${esc(name)} appelle ${miniCard(card)}
    ${mine ? '<small>C\'est toi qui l\'as : tu es son partenaire (en secret)</small>' : '<small>Son partenaire se révèle en jouant cette carte</small>'}</div>`;
}

/** A poignée shown: its trumps, a moment, for everyone. */
export function handfulAnnounce(name: string, level: 1 | 2 | 3, cards: TCard[], art: Record<string, string>) {
  return `<div class="announce-box handful"><small>Poignée</small>${esc(name)} montre une ${HANDFUL_NAMES[level - 1]}
    <div class="handful-cards">${cards.map(cd => `<span class="pcard">${tarotSvg(cd, art)}</span>`).join('')}</div>
    <small>${HANDFUL_POINTS[level - 1]} points pour le camp qui gagnera la donne</small></div>`;
}
export const chelemAnnounce = (name: string) => `<div class="announce-box take"><small>Chelem</small>${esc(name)} annonce un chelem<span class="ann-bid">tous les plis</span></div>`;

/** A player's won tricks, each as a small fan, in a grid that fits the table (hovering his chip or my pile). */
function tricksView(t: Tarot, id: string, name: string, art: Record<string, string>) {
  const tr = t.tricks[id] ?? [];
  const fan = (plays: TPlay[]) => `<div class="tv-trick" style="--m:${(plays.length - 1) / 2}">${plays.map((p, k) => `<span class="tv-card" style="--k:${k}">${tarotSvg(p.card, art)}</span>`).join('')}</div>`;
  return `<div class="tricks-view"><p class="tv-head">Plis gagnés par ${esc(name)} · ${tr.length}</p><div class="tv-grid">${tr.map(fan).join('')}</div></div>`;
}

/** My won tricks, at the bottom right of the table: a card-sized place printed on the felt, then the pile. */
function myPile(t: Tarot, me: string, look: boolean) {
  const n = t.tricks[me]?.length ?? 0;
  return `<div class="won-pile ${n ? '' : 'is-empty'}" ${n && look ? `data-won="${esc(me)}"` : ''} title="${n ? (look ? 'Survoler pour voir tes plis' : 'Plis cachés : l\'hôte a désactivé leur consultation') : 'Tes plis gagnés viendront ici'}">
    ${n ? `${Array.from({ length: Math.min(3, n) }, (_, k) => `<span class="won-card" style="--k:${k}">${backSvg()}</span>`).join('')}<b class="won-n">${n}</b>` : ''}</div>`;
}

const bidName = (b: Bid) => (b === 'pass' ? 'Passe' : BIDS[b].name);

export function tarotTableHtml(c: TarotCtx) {
  const { t, me } = c, mine = t.hands[me] ?? [], myTurn = t.turn === me;
  const name = (id: string) => (id === me ? 'Toi' : c.who(id).name);
  // at 5, the called card, then (once played) the partner
  const called = t.called ? ` · appelle ${miniCard(t.called)}${t.revealed && t.partner && t.partner !== t.taker ? ` avec ${esc(name(t.partner))}` : ''}` : '';
  const contract = t.taker && t.bid ? `${esc(name(t.taker))} : ${BIDS[t.bid].name}${called}` : 'enchères';
  const doing = { bid: 'parler', call: 'appeler un Roi', dog: 'faire l\'écart', play: 'jouer', done: '' }[t.phase];
  const turnText = t.turn === null ? '' : myTurn ? ` · <b>à toi de ${doing}</b>` : ` · à ${esc(name(t.turn))} de ${doing}`;
  const info = `Donne ${t.deal} · ${contract}${turnText}`;
  const seats = t.seats.filter(id => id !== me).map(id => {
    const p = c.who(id), b = t.bids[id];
    const won = t.tricks[id]?.length ?? 0;
    return seatPill(p, { cls: `${t.turn === id ? 'is-turn' : ''} ${c.wonView === id ? 'is-viewed' : ''}`, attrs: `data-seat="${esc(id)}" ${won && c.showTricks ? `data-won="${esc(id)}"` : ''}`,
      sub: `${t.taker === id ? `<span class="role-badge role-president" title="Preneur : ${BIDS[t.bid!].name}">Preneur</span>` : t.revealed && t.partner === id ? '<span class="role-badge role-vice">Partenaire</span>' : t.phase === 'bid' && b ? `<span class="role-badge">${bidName(b)}</span>` : ''}
        ${t.handfuls?.[id] ? `<span class="role-badge role-handful" title="${t.handfuls[id].cards.length} atouts montrés">${HANDFUL_NAMES[t.handfuls[id].level - 1]}</span>` : ''}${t.chelem === id ? '<span class="role-badge role-chelem">Chelem annoncé</span>' : ''}${won ? `<span class="seat-tricks" title="${c.showTricks ? 'Survoler pour voir ses plis' : 'Plis cachés : l\'hôte a désactivé leur consultation'}">${won} pli${won > 1 ? 's' : ''}</span>` : ''}`,
      side: `<span class="seat-cards" title="${t.hands[id].length} cartes"><b>${t.hands[id].length}</b></span>` });
  }).join('');

  // the middle of the table: the chien shown, the trick (the last one, dimmed, until the next card), or the count
  let pile = '', text = '';
  const row = (plays: { by: string; card: TCard }[], closed = false) => `<div class="tarot-trick ${closed ? 'is-closed' : ''}">${plays.map(p => `<span class="trick-card">
      <span class="pcard on-table" data-card="${p.card.id}">${tarotSvg(p.card, c.art)}</span><small>${esc(name(p.by))}</small></span>`).join('')}</div>`;
  if (t.phase === 'bid') {
    const best = Object.values(t.bids).filter(b => b !== 'pass');
    text = best.length ? `Enchère la plus haute : ${bidName(best.reduce((a, b) => (BIDS[b as Exclude<Bid, 'pass'>].mult > BIDS[a as Exclude<Bid, 'pass'>].mult ? b : a)))}` : 'Enchères : chacun parle une fois, plus haut que le précédent, ou passe';
  } else if (t.phase === 'call') {
    text = t.taker === me ? 'À 5 : appelle un Roi — celui qui l\'a sera ton partenaire, sans le dire, jusqu\'à ce qu\'il le joue' : `${esc(name(t.taker!))} appelle un Roi…`;
  } else if (t.phase === 'dog') {
    pile = `<div class="tarot-trick dog">${t.chien.map(cd => `<span class="pcard on-table" data-card="${cd.id}">${tarotSvg(cd, c.art)}</span>`).join('')}</div>`;
    text = `Le chien, pris par ${esc(name(t.taker!))} : ${t.taker === me ? `écarte-en ${ecartSize(t)} (ni Roi ni bout)` : 'il fait son écart…'}`;
  } else if (t.phase === 'play') {
    const closed = !t.trick.length && t.lastTrick.length > 0 && c.showLast;   // shown until it goes to its winner
    pile = row(closed ? t.lastTrick : t.trick);
    const lead = t.trick.find(p => p.card.kind !== 'excuse')?.card;
    text = closed ? `${esc(name(t.lastWinner!))} remporte le pli` : !t.trick.length && t.lastWinner ? `${esc(name(t.lastWinner))} ouvre` : lead ? (lead.kind === 'trump' ? 'Atout demandé : monte si tu peux' : `${({ S: '♠️', H: '♥️', D: '♦️', C: '♣️' })[lead.s!]} demandé : fournis, sinon coupe (et surcoupe)`) : 'À l\'entame';
  } else if (t.result) {
    const r = t.result, alone = t.seats.length === 5 && !r.partner;
    pile = `<div class="cg-results tarot-results"><h3>Donne ${t.deal} : ${esc(name(r.taker))}${r.partner ? ` et ${esc(name(r.partner))}` : ''} ${r.won ? (r.partner ? 'gagnent' : 'gagne') : (r.partner ? 'chutent' : 'chute')}</h3>
      <p class="note">${BIDS[r.bid].name} · ${r.bouts} bout${r.bouts > 1 ? 's' : ''} → ${r.need} points à faire · ${String(r.made).replace('.', ',')} faits
        → ${r.won ? '' : '−'}(25 + ${Math.round(Math.abs(r.made - r.need))})${r.petit ? ` ${r.petit === 'taker' ? '+' : '−'} 10 (Petit au bout)` : ''} × ${BIDS[r.bid].mult}${r.handfuls ? ` ${r.handfuls > 0 ? '+' : '−'} ${Math.abs(r.handfuls)} (poignée)` : ''}${r.chelem ? ` ${r.chelem > 0 ? '+' : '−'} ${Math.abs(r.chelem)} (chelem)` : ''} = ${r.score}${t.seats.length === 5 ? (alone ? ' · seul contre 4 : × 4' : ' · preneur × 2, partenaire × 1') : ''}</p>
      <ol>${t.seats.map(id => `<li><span class="dot" style="--c:${c.who(id).color}"></span><b>${esc(name(id))}</b>${id === r.taker ? '<span class="role-badge role-president">Preneur</span>' : id === r.partner ? '<span class="role-badge role-vice">Partenaire</span>' : '<span class="role-badge">Défense</span>'}
        <span class="pts ${r.marks[id] < 0 ? 'neg' : ''}">${r.marks[id] > 0 ? '+' : ''}${r.marks[id]}</span></li>`).join('')}</ol>
      ${c.host ? '<button class="btn" type="button" data-action="cards-deal">Donne suivante</button>' : '<p class="note">L\'hôte lance la donne suivante.</p>'}</div>`;
  } else {
    pile = `<div class="cg-results"><h3>${esc(t.note)}</h3>${c.host ? '<button class="btn" type="button" data-action="cards-deal">Donne suivante</button>' : ''}</div>`;
  }

  // my hand: in the bids, to look at; for the écart, what can go (no King, no bout) selectable; in play, the legal cards
  const ok = new Set((t.phase === 'play' && myTurn ? legal(t, me) : t.phase === 'dog' && t.taker === me ? mine.filter(cd => canDiscard(t, cd)) : mine).map(cd => cd.id));
  const active = (t.phase === 'play' && myTurn) || (t.phase === 'dog' && t.taker === me);
  const hand = c.playing ? `<div class="cg-hand" data-hand style="--n:${mine.length};--r:${c.fan.r}px">${mine.map((cd, i) => `<button type="button"
      class="pcard in-hand ${c.selected.has(cd.id) ? 'is-selected' : ''} ${active && !ok.has(cd.id) ? 'is-off' : ''} ${t.phase === 'dog' && t.chien.some(x => x.id === cd.id) ? 'is-new' : ''}"
      data-action="card-pick" data-card="${cd.id}" style="--a:${handAngle(i, mine.length, c.fan.step)}rad" aria-pressed="${c.selected.has(cd.id)}">${tarotSvg(cd, c.art)}</button>`).join('')}</div>` : '';
  const trumps = mine.filter(cd => cd.kind !== 'suit').length, bouts = mine.filter(isBout).length;
  const chip = `<span class="role-badge trump-count" title="Atouts et Excuse dans ta main">Atouts ${trumps} · bouts ${bouts}</span>`;
  // eslint-disable-next-line no-useless-assignment
  let actions = '';
  if (!c.playing) actions = `<div class="cg-watch"><p class="note">Tu regardes la partie : le Tarot se joue à ${t.seats.length} (des robots complètent les places libres). Prends la place d'un robot : sa main et ses points deviennent les tiens.</p>
    <button class="btn cg-join" type="button" data-action="table-join">Prendre une place</button></div>`;
  else if (t.phase === 'call' && t.taker === me) {
    actions = `<div class="cg-actions call">${chip}<span class="cg-hint">Appelle :</span>${callable(t).map(cd => `<button class="call-card" type="button" data-action="tarot-call" data-v="${cd.id}"
      title="Appeler ${cardName(cd)}${mine.some(x => x.id === cd.id) ? ' (le tien : tu joues seul)' : ''}">${tarotSvg(cd, c.art, 'small')}</button>`).join('')}</div>`;
  }
  else if (t.phase === 'bid') {
    const can = bidsFor(t);
    actions = `<div class="cg-actions">${chip}<span class="cg-hint">${myTurn ? 'Ton enchère :' : 'Les autres parlent…'}</span>
      ${(['pass', 'prise', 'garde', 'sans', 'contre'] as Bid[]).map(b => `<button class="btn ${b === 'pass' ? 'ghost' : ''} sm-bid" type="button" data-action="tarot-bid" data-v="${b}" ${myTurn && can.includes(b) ? '' : 'disabled'}>${bidName(b)}</button>`).join('')}</div>`;
  } else if (t.phase === 'dog' && t.taker === me) {
    const n = mine.filter(cd => c.selected.has(cd.id)).length;
    const k = ecartSize(t);
    actions = `<div class="cg-actions">${chip}<span class="cg-hint">Écart : ${n} / ${k} — choisis ${k} cartes (ni Roi ni bout ; atout seulement s'il le faut)</span>
      <button class="btn" type="button" data-action="tarot-ecart" ${n === k ? '' : 'disabled'}>Faire l'écart</button></div>`;
  } else {
    const sel = mine.find(cd => c.selected.has(cd.id));
    const sizes = handfulSizes(t.seats.length);
    const announce = t.phase === 'play' ? [
      ...(t.taker === me && !t.chelem && !(t.started ?? []).length && !t.trick.length ? ['<button class="btn ghost sm" type="button" data-action="tarot-chelem" title="Tous les plis : +400 réussi, −200 manqué ; tu entames">Annoncer un chelem</button>'] : []),
      ...(myTurn ? handfulLevels(t, me).map(lv => `<button class="btn ghost sm" type="button" data-action="tarot-handful" data-v="${lv}" title="Montrer ${sizes[lv - 1]} atouts : ${HANDFUL_POINTS[lv - 1]} points pour le camp qui gagne la donne">Montrer une ${HANDFUL_NAMES[lv - 1]} (${sizes[lv - 1]})</button>`) : []),
    ].join('') : '';
    actions = `<div class="cg-actions">${chip}${announce}<span class="cg-hint">${t.phase !== 'play' ? '' : myTurn ? (sel ? `Jouer ${cardName(sel)} ?` : 'Choisis une carte (les autres sont grisées)') : 'Attends ton tour…'}</span>
      <button class="btn" type="button" data-action="cards-play" ${t.phase === 'play' && myTurn && sel ? '' : 'disabled'}>Jouer</button></div>`;
  }
  return `<div class="cards-game tarot ${active || (myTurn && (t.phase === 'bid' || t.phase === 'call')) ? 'my-turn' : ''}">${head(`Tarot à ${t.seats.length}`, info)}
    <div class="cg-table"><ul class="cg-seats" style="--cols:${seatCols(t.seats.filter(id => id !== me).length)}">${seats}</ul><div class="cg-pile" data-pile>${pile}</div><p class="cg-pile-text">${text}</p>
      ${c.playing ? myPile(t, me, c.showTricks) : ''}${c.showTricks && c.wonView && t.tricks[c.wonView]?.length ? tricksView(t, c.wonView, name(c.wonView), c.art) : ''}</div>
    <div class="cg-me">${hand}${c.playing ? '<button class="btn ghost sm cg-leave" type="button" data-action="table-leave" title="Un robot joue ta main à ta place">Quitter la table</button>' : ''}${actions}</div></div>`;
}

// ------------------------------------------------------------------ the rules
const S = (s: 'S' | 'H' | 'D' | 'C', r: number): TCard => ({ id: `${s}${r}`, kind: 'suit', r, s });
const T = (r: number): TCard => ({ id: `T${r}`, kind: r ? 'trump' : 'excuse', r });
const cards = (cs: TCard[], art: Record<string, string>) => `<span class="rule-cards">${cs.map(cd => tarotSvg(cd, art, 'small')).join('')}</span>`;

export function tarotRulesHtml(art: Record<string, string>) {
  return rulesFrame('Tarot — les règles', `
    <section><h3>But</h3><p>À 4 joueurs, celui qui prend (le <b>preneur</b>) joue seul contre les trois autres (la <b>défense</b>) ; à 5, avec un partenaire qu'il appelle. Il doit faire assez de points dans ses plis, selon son contrat et ses bouts. Des robots prennent les places libres.</p></section>
    <section><h3>Les 78 cartes</h3><p>4 couleurs de 14 cartes (1 à 10, Valet, Cavalier, Dame, Roi), <b>21 atouts</b> — numérotés dans les coins, sur leur image — et l'<b>Excuse</b> (★).</p>
      ${cards([S('H', 1), S('S', 10), S('D', 11), S('C', 12), S('H', 13), S('S', 14)], art)}
      ${cards([T(2), T(7), T(13), T(19)], art)}
      <p>Les trois <b>bouts</b> : le Petit (1), le 21 et l'Excuse.</p>${cards([T(1), T(21), T(0)], art)}
      <p class="note">Distribution (réglage de l'hôte) : <b>aléatoire</b>, le paquet mélangé à chaque donne ; ou <b>à l'ancienne</b>, comme à table : les plis et l'écart ramassés, coupés, distribués 3 par 3 avec le chien carte par carte — plus de mains déséquilibrées.</p></section>
    <section><h3>Valeur des cartes (91 en tout)</h3><ol class="rule-roles">
      <li><span>Bout ou Roi</span><span></span><b>4,5</b></li><li><span>Dame</span><span></span><b>3,5</b></li><li><span>Cavalier</span><span></span><b>2,5</b></li>
      <li><span>Valet</span><span></span><b>1,5</b></li><li><span>Autre carte</span><span></span><b>0,5</b></li></ol></section>
    <section><h3>Enchères</h3><p>Chacun parle une fois, plus haut que le précédent, ou passe. Si tous passent, on redonne.</p><ol class="rule-roles">
      <li><span class="role-badge">Prise</span><span>le chien est montré, le preneur le prend et écarte 6 cartes</span><b>× 1</b></li>
      <li><span class="role-badge">Garde</span><span>pareil</span><b>× 2</b></li>
      <li><span class="role-badge">Garde sans</span><span>le chien va au preneur sans être vu</span><b>× 4</b></li>
      <li><span class="role-badge">Garde contre</span><span>le chien va à la défense</span><b>× 6</b></li></ol>
      <p class="note">Écart : ni Roi ni bout ; un atout seulement si on ne peut pas faire autrement.</p></section>
    <section><h3>Les plis</h3><p>Il faut <b>fournir</b> la couleur demandée ; sinon <b>couper</b> (jouer un atout), et <b>surcouper</b> si un atout est déjà posé ; à l'atout demandé, <b>monter</b> si on peut. Sans la couleur ni d'atout, on défausse ce qu'on veut.</p>
      <div class="rule-example">${cards([S('H', 7)], art)}<span class="rule-arrow">sans cœur :</span>${cards([T(5)], art)}<span class="rule-arrow">le suivant surcoupe</span>${cards([T(12)], art)}</div>
      <p>L'<b>Excuse</b> se joue à tout moment, ne gagne jamais le pli et reste à son camp.</p></section>
    <section><h3>À 5 joueurs</h3><p>15 cartes chacun, un chien de 3 (donc un écart de 3). Après les enchères, le preneur <b>appelle un Roi</b>
      (une Dame s'il a les 4 Rois, un Cavalier s'il a aussi les 4 Dames) : celui qui l'a devient son partenaire, en secret, jusqu'à ce qu'il le joue.
      Au premier pli, on n'entame pas dans la couleur appelée, sauf avec le Roi lui-même.</p>
      <div class="rule-example"><span class="rule-arrow">« J'appelle le Roi de cœur »</span>${cards([S('H', 14)], art)}</div>
      <p>Marques : le preneur × 2, son partenaire × 1, chaque défenseur × 1 dans l'autre sens. S'il s'est appelé lui-même ou si le Roi est au chien, il joue seul contre 4 : × 4.</p></section>
    <section><h3>Le compte</h3><p>Points à faire selon les bouts du preneur : 0 bout <b>${NEED[0]}</b>, 1 bout <b>${NEED[1]}</b>, 2 bouts <b>${NEED[2]}</b>, 3 bouts <b>${NEED[3]}</b>.
      Marque = (25 + l'écart) × le contrat ; le preneur la gagne 3 fois (ou la perd), chaque défenseur la perd une fois (ou la gagne).</p>
      <p class="note">Exemple : Garde, 2 bouts, 47 points faits pour ${NEED[2]} → (25 + 6) × 2 = 62 : le preneur +186, chaque défenseur −62.</p></section>
    <section><h3>Les primes</h3>
      <p><b>Petit au bout</b> : le Petit dans le dernier pli rapporte 10 × le contrat au camp qui gagne ce pli, que la donne soit gagnée ou non.</p>
      <p><b>Poignée</b> : avant ta première carte, montre ${handfulSizes(4).join(', ')} atouts à 4 (${handfulSizes(5).join(', ')} à 5) : simple, double ou triple poignée, ${HANDFUL_POINTS.join(', ')} points (non multipliés) pour le camp qui <b>gagne</b> la donne. L'Excuse compte pour un atout si c'est le dernier.</p>
      <p><b>Chelem</b> : faire tous les plis. Annoncé par le preneur avant la première carte (il entame) : +400 réussi, −200 manqué ; réussi sans annonce : +200. Dans un chelem, l'Excuse menée au dernier pli le gagne.</p>
      <p class="note">Marque = ((25 + l'écart) ± Petit au bout) × le contrat ± poignées ± chelem.</p></section>`);
}


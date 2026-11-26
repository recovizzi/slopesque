// The Texas Hold'em's table (openspec: card-games, Texas Hold'em): the seats around (their bank with a crown for the
// biggest, the button and the blinds, their cards — backs, or turned over at the showdown — and, under each one, its
// bet in chips on the felt), the pot in chips and the board in the middle with the deck the cards come from, my two
// cards with what I hold and my chips in piles by colour (clicked: they go to my bet), the betting buttons that say
// the amounts; the showdown (hands turned over, the winning 5 cards brought forward, the pots and who took them), the
// game's places; the rules with the hands and the chips drawn. The flights (cards from the deck, chips to the pot and
// to the winner) are ui/holdem-anim.ts.
import { backSvg, faceSvg, head, kickBtn, rulesFrame, seatCols, seatLabel, seatPill } from '../cards';
import { esc } from '../../../legacy/html';
import { icon } from '../../../legacy/icons';
import { Holdem as H } from '@slopesque/engines';

type G = H.Holdem; type C = H.HCard;

export const fmt = (n: number) => n.toLocaleString('fr-FR');
export const holdemCard = (c: C, cls = '') => faceSvg(H.rankLabel(c.r), c.s, H.cardName(c), cls);
const STREETS: Record<H.Street, string> = { preflop: 'Avant le flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Abattage' };
const ACTS: Record<H.Act, string> = { fold: 'Couché', check: 'Parole', call: 'Suit', bet: 'Mise', raise: 'Relance', allin: 'Tapis', sb: 'Petite blinde', bb: 'Grosse blinde' };
const placeName = (p: number) => (p === 1 ? '1re' : `${p}e`);

// ------------------------------------------------------------------ chips
/** The chips' colours: 5 white, 25 red, 100 black, 500 purple, 1 000 yellow, 5 000 blue. */
export const CHIP_LOOK: Record<number, { fill: string; edge: string; ink: string; name: string }> = {
  5: { fill: '#f4f1e8', edge: '#2f6fd0', ink: '#1c1b19', name: 'blanc' },
  25: { fill: '#c62828', edge: '#fff', ink: '#fff', name: 'rouge' },
  100: { fill: '#232323', edge: '#fff', ink: '#fff', name: 'noir' },
  500: { fill: '#6a3fb5', edge: '#fff', ink: '#fff', name: 'violet' },
  1000: { fill: '#e6b800', edge: '#fffbe6', ink: '#3d2f00', name: 'jaune' },
  5000: { fill: '#1e6fd9', edge: '#fff', ink: '#fff', name: 'bleu' },
};
const chipLabel = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v));
/** A chip seen from above: its colour, the marks on its edge, its value in the middle. */
export function chipSvg(v: number) {
  const k = CHIP_LOOK[v] ?? CHIP_LOOK[5]!;
  return `<svg class="chip-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11.3" fill="${k.fill}" stroke="#0007" stroke-width=".7"/>
    <circle cx="12" cy="12" r="9.6" fill="none" stroke="${k.edge}" stroke-width="2.6" stroke-dasharray="3.2 4.34"/>
    <circle cx="12" cy="12" r="6.4" fill="${k.fill}" stroke="${k.edge}" stroke-width=".8"/><text x="12" y="14.4" text-anchor="middle" class="chip-v" fill="${k.ink}">${chipLabel(v)}</text></svg>`;
}
/** A pile of one value: up to `max` chips drawn on top of each other, the count beyond. */
function pile(v: number, n: number, max = 8) {
  const shown = Math.min(n, max);
  return `<span class="hd-pile" style="--n:${shown}" title="${n} jeton${n > 1 ? 's' : ''} de ${fmt(v)}">${Array.from({ length: shown }, (_, k) => `<i style="--k:${k}">${chipSvg(v)}</i>`).join('')}${n > max ? `<small>×${n}</small>` : ''}</span>`;
}
/** An amount in chips, piles side by side (a bet, the pot). */
export const chipsHtml = (amount: number, cls = '', chips: [number, number][] = H.chipsOf(amount)) => (amount > 0 ? `<span class="hd-chips ${cls}">${chips.map(([v, n]) => pile(v, n, 6)).join('')}</span>` : '');
/** The chips clicked, as they were (four 25 stay four red chips), from the biggest. */
export const grouped = (vs: number[]): [number, number][] => [...new Set(vs)].sort((a, b) => b - a).map(v => [v, vs.filter(x => x === v).length]);

export interface HoldemCtx {
  g: G;
  me: string;                       // my seat ('' : watching)
  playing: boolean;
  host: boolean;
  who: (id: string) => { name: string; color: string; bot?: boolean; photo?: string | null };
  fresh: Set<string>;               // the hole cards just turned over (« seat:i »): they flip
  pending: number[];                // the chips I clicked, not yet bet
  pay: boolean;                     // the showdown before the pot goes to its winners (the banks without it)
  late: { seat: string; secs: number; vote: boolean } | null;
  seats: { free: number; total: number; mine: boolean; takes: string; full: boolean };
}

/** The sizes of a raise (its total): the minimum, half the pot, the pot (after calling), all-in. */
export function sizes(g: G, me: string) {
  const o = H.options(g, me);
  if (!o?.raise) return null;
  const owe = o.call, pot = H.pot(g), clamp = (x: number) => Math.min(o.raise!.max, Math.max(o.raise!.min, Math.round(x / H.UNIT) * H.UNIT));
  return { min: o.raise.min, half: clamp(g.current + (pot + owe) / 2), pot: clamp(g.current + pot + owe), max: o.raise.max };
}

/** What my clicked chips make: the move they'd be (and its button), or why not yet. */
export function pendingMove(g: G, me: string, pending: number): { move: H.Move | null; label: string } {
  const o = H.options(g, me);
  if (!o || pending <= 0) return { move: null, label: 'Clique tes jetons pour miser' };
  const bet = g.bets[me] ?? 0, max = bet + (g.stacks[me] ?? 0), to = Math.min(max, bet + pending);
  if (to >= max && max > bet) return { move: { act: 'allin' }, label: `Tapis ${fmt(max)}` };
  if (to < g.current) return { move: null, label: `Encore ${fmt(g.current - to)} pour suivre` };
  if (to === g.current) return { move: { act: 'call' }, label: `Suivre ${fmt(o.call)}` };
  if (!o.raise) return { move: null, label: 'Plus de relance possible : suis' };
  if (to < o.raise.min) return { move: null, label: `Relance minimum : ${fmt(o.raise.min)}` };
  return { move: { act: 'raise', to }, label: `${g.current === 0 ? 'Miser' : 'Relancer à'} ${fmt(to)}` };
}

/** What I hold, in words: before the flop « As et Roi, assortis » / « Paire de 8 », then the best hand. */
export function holding(g: G, me: string) {
  const h = g.holes[me];
  if (!h || h.length < 2 || h[0]!.r === 0) return '';
  if (!g.board.length) {
    const [a, b] = [...h].sort((x, y) => y.r - x.r) as [C, C];
    return a.r === b.r ? H.handName(H.evaluate(h)) : `${H.rankName(a.r)} et ${H.rankName(b.r)}${a.s === b.s ? ', assortis' : ''}`;
  }
  return H.handName(H.evaluate([...h, ...g.board]));
}

const winners = (g: G) => g.result?.awards.flatMap(a => a.winners) ?? [];
const showdown = (g: G) => g.street === 'showdown' && !!g.result && !g.result.uncontested;
/** A bank on the table: during the payment, without what the pot is bringing it. */
const bank = (c: HoldemCtx, s: string) => (c.g.stacks[s] ?? 0) - (c.pay ? c.g.result?.won[s] ?? 0 : 0);
/** The biggest bank (not when all are equal): its crown. */
function leaders(c: HoldemCtx) {
  const live = c.g.seats.filter(s => !c.g.out.includes(s)), banks = live.map(s => bank(c, s) + (c.g.bets[s] ?? 0)), top = Math.max(...banks);
  return banks.every(b => b === top) ? new Set<string>() : new Set(live.filter((_, i) => banks[i] === top));
}
const CROWN = '<span class="seat-crown" role="img" aria-label="La plus grosse banque" title="La plus grosse banque">👑</span>';
/** A pile of chips (a bank), seen from the side: black, red, white. */
const PILE_ICON = `<svg class="pile-ico" viewBox="0 0 16 16" aria-hidden="true">${[['#232323', 11.4], ['#c62828', 7.9], ['#f4f1e8', 4.4]].map(([c, y]) => `<rect x="1.5" y="${y}" width="13" height="3.3" rx="1.6" fill="${c}" stroke="#0009" stroke-width=".6"/><path d="M5 ${Number(y) + .5}v2.3M8 ${Number(y) + .5}v2.3M11 ${Number(y) + .5}v2.3" stroke="${c === '#f4f1e8' ? '#2f6fd0' : '#fff'}" stroke-width=".9"/>`).join('')}</svg>`;

function holeCards(c: HoldemCtx, s: string, big: boolean) {
  const { g } = c, best = g.result?.best[s]?.five ?? [], sd = showdown(g) && !c.pay;
  return (g.holes[s] ?? []).map((cd, i) => {
    const cls = `${c.fresh.has(`${s}:${i}`) ? 'is-turned' : ''} ${sd && cd.r ? (best.includes(cd.id) && winners(g).includes(s) ? 'is-best' : 'is-dim') : ''}`;
    return `<span class="hd-card ${big ? 'pcard' : 'mini'} ${cls}" style="--i:${i}" data-hole="${esc(s)}:${i}" data-card="${cd.r ? cd.id : ''}">${cd.r ? holdemCard(cd) : backSvg()}</span>`;
  }).join('');
}

function badges(g: G, s: string) {
  if (g.over) return '';
  return (s === g.button ? '<b class="hd-pos dealer" title="Le bouton : le donneur de cette main">D</b>' : '')
    + (s === g.sbSeat ? '<b class="hd-pos" title="Petite blinde">PB</b>' : s === g.bbSeat ? '<b class="hd-pos" title="Grosse blinde">GB</b>' : '');
}
const actBadge = (g: G, s: string) => {
  const a = g.last[s];
  if (!a || a.act === 'sb' || a.act === 'bb') return '';
  return `<span class="hd-act act-${a.act}">${a.act === 'raise' || a.act === 'bet' ? `${ACTS[a.act]}${a.act === 'raise' ? ' à' : ''} ${fmt(a.amount)}` : ACTS[a.act]}</span>`;
};
/** A bet on the felt, under its player: its chips and the amount (mine: with the chips I clicked, not yet bet). */
function betSpot(s: string, amount: number, pending: number[] = [], cls = '', act = '', cards = '') {
  const more = pending.reduce((x, y) => x + y, 0);
  return `<div class="hd-bet-spot ${cls}" data-bet="${esc(s)}">${cards}${chipsHtml(amount)}${more ? chipsHtml(more, 'is-pending', grouped(pending)) : ''}${amount + more ? `<b>${amount ? fmt(amount) : ''}${more ? `<i>${amount ? ' + ' : '+ '}${fmt(more)}</i>` : ''}</b>` : ''}${act}</div>`;
}

function seatHtml(c: HoldemCtx, s: string, crown: Set<string>) {
  const { g } = c, p = c.who(s), out = g.out.includes(s), folded = g.folded.includes(s), won = c.pay ? 0 : g.result?.won[s] ?? 0, b = bank(c, s);
  const sub = out ? `<span class="seat-state">éliminé · ${placeName(g.places[s] ?? 0)}</span>`
    : `<span class="hd-stack" title="Sa banque">${PILE_ICON}${fmt(b)}</span>${won ? `<span class="hd-won">+${fmt(won)}</span>` : ''}`;
  const side = badges(g, s), cards = out || !g.inHand.includes(s) || folded ? '' : `<span class="hd-holes">${holeCards(c, s, false)}</span>`;   // his cards in front of him, on the felt
  const hand = g.result?.best[s] && showdown(g) && !c.pay ? `<small class="hd-hand">${esc(g.result.best[s]!.name)}</small>` : '';
  return `<li class="hd-place">${seatPill(p, { tag: 'div', cls: `hd-seat ${g.turn === s ? 'is-turn' : ''} ${c.late?.seat === s ? 'is-late' : ''} ${folded || out ? 'is-out' : ''} ${won ? 'is-winner' : ''}`,
    attrs: `data-seat="${esc(s)}"`, mark: crown.has(s) ? CROWN : '', sub, side, extra: kickBtn(c.late?.seat === s ? c.late : null) })}
    ${betSpot(s, g.bets[s] ?? 0, [], '', out ? '' : hand || (won ? '' : actBadge(g, s)), cards)}</li>`;
}

function boardHtml(c: HoldemCtx) {
  const { g } = c, sd = showdown(g) && !c.pay, best = sd ? g.result!.best[g.result!.awards[0]?.winners[0] ?? '']?.five ?? [] : [];
  const slots = Array.from({ length: 5 }, (_, i) => {
    const cd = g.board[i];
    if (!cd) return '<span class="hd-slot" aria-hidden="true"></span>';
    return `<span class="pcard hd-card on-table ${sd ? (best.includes(cd.id) ? 'is-best' : 'is-dim') : ''}" data-card="${cd.id}">${holdemCard(cd)}</span>`;
  }).join('');
  const deck = `<div class="hd-deck" data-deck title="Le paquet">${[0, 1, 2].map(k => `<span class="hd-deck-card" style="--k:${k}">${backSvg()}</span>`).join('')}</div>`;
  return `<div class="hd-felt">${deck}<div class="hd-board" title="Les cartes communes : chacun les utilise avec ses deux cartes">${slots}</div></div>`;
}

/** The pot, in chips: what the past rounds collected (the bets of this round are still in front of the players);
 *  after the payment, the pots and who took them. */
function potHtml(c: HoldemCtx) {
  const { g } = c, name = (s: string) => (s === c.me ? 'Toi' : c.who(s).name);
  if (g.street === 'showdown' && g.result && !c.pay) {
    const lines = g.result.awards.map(a => `<li><b>${fmt(a.amount)}</b>${g.result!.awards.length > 1 ? ` <small>${a.side ? `pot annexe${g.result!.awards.length > 2 ? ` ${a.side}` : ''}` : 'pot principal'}</small>` : ''}
      → <b>${a.winners.map(w => esc(name(w))).join(' et ')}</b>${a.winners.length > 1 ? ' (partagé)' : ''}${a.hand ? ` · ${esc(a.hand)}` : ''}</li>`).join('');
    return `<div class="hd-pot" data-pot><ul class="hd-awards">${lines}</ul></div>`;
  }
  const inPot = c.pay && g.result ? g.result.awards.reduce((n, a) => n + a.amount, 0) : H.pot(g) - Object.values(g.bets).reduce((x, y) => x + y, 0);
  const live = g.inHand.filter(s => !g.folded.includes(s)), top = Math.max(0, ...live.map(s => g.paid[s] ?? 0));
  const side = new Set(live.filter(s => g.stacks[s] === 0 && (g.paid[s] ?? 0) < top).map(s => g.paid[s])).size;   // an all-in for less: a side pot above it
  return `<div class="hd-pot" data-pot title="Les mises des tours précédents">${chipsHtml(inPot)}<span class="hd-pot-n">Pot <b>${fmt(c.pay ? inPot : H.pot(g))}</b>${side && !c.pay ? ` <small>dont ${side} pot${side > 1 ? 's' : ''} annexe${side > 1 ? 's' : ''}</small>` : ''}</span></div>`;
}

/** My chips in piles by colour: clicked, a chip goes to my bet (while it's my turn). */
function rackHtml(c: HoldemCtx, mine: boolean) {
  const { g } = c, more = mine ? c.pending.reduce((x, y) => x + y, 0) : 0, left = bank(c, c.me) - more;
  const room = mine ? (g.stacks[c.me] ?? 0) - more : 0;
  return `<div class="hd-rack ${mine ? 'is-active' : ''}" title="${mine ? 'Clique un jeton pour l\'ajouter à ta mise' : 'Ta banque'}">${H.rackOf(left).map(([v, n]) => mine
    ? `<button class="hd-rack-pile" type="button" data-action="holdem-chip" data-v="${v}" ${v <= room ? '' : 'disabled'} aria-label="Miser un jeton de ${fmt(v)}">${pile(v, n, 10)}</button>`
    : `<span class="hd-rack-pile">${pile(v, n, 10)}</span>`).join('')}</div>`;
}

/** The betting bar: fold, check or call (the amount), all-in; the sizes; my clicked chips confirmed (or cleared). */
function actionsHtml(c: HoldemCtx) {
  const { g } = c, o = H.options(g, c.me), mine = holding(g, c.me);
  const hold = mine ? `<span class="hd-holding" title="Ta meilleure combinaison avec les cartes communes">Tu as : <b>${esc(mine)}</b></span>` : '';
  if (!o) {
    const why = g.out.includes(c.me) ? `Éliminé : ${placeName(g.places[c.me] ?? 0)} place. Tu regardes la fin de la partie.` : g.folded.includes(c.me) ? 'Couché : attends la main suivante.'
      : g.street === 'showdown' ? 'Main suivante dans un instant…' : g.inHand.includes(c.me) && (g.stacks[c.me] ?? 0) === 0 ? 'Tapis : les cartes vont parler.' : 'Attends ton tour…';
    return `<div class="cg-actions hd-actions">${hold}<span class="cg-hint">${why}</span></div>`;
  }
  const more = c.pending.reduce((x, y) => x + y, 0), z = sizes(g, c.me), bet = g.bets[c.me] ?? 0, p = pendingMove(g, c.me, more), stack = g.stacks[c.me] ?? 0;
  const call = o.check ? 'Parler' : o.call >= stack ? `Suivre — tapis ${fmt(o.call)}` : `Suivre ${fmt(o.call)}`;
  const preset = (label: string, to: number) => `<button class="btn ghost xs" type="button" data-action="holdem-pend" data-v="${to - bet}" ${to - bet === more ? 'aria-pressed="true"' : ''}>${label}</button>`;
  const allin = o.allin > g.current && o.allin > bet + o.call;   // all-in is more than calling
  return `<div class="cg-actions hd-actions is-mine">${hold}
    <button class="btn ghost" type="button" data-action="holdem-fold" ${o.check ? 'title="Tu peux parler sans rien payer"' : ''}>Se coucher</button>
    <button class="btn" type="button" data-action="${o.check ? 'holdem-check' : 'holdem-call'}">${call}</button>
    ${allin ? `<button class="btn danger" type="button" data-action="holdem-allin">Tapis ${fmt(o.allin)}</button>` : ''}</div>
    <div class="cg-actions hd-actions hd-bet-bar">${z ? `<span class="hd-sizes">${preset('Min', z.min)}${preset('½ pot', z.half)}${preset('Pot', z.pot)}</span>` : ''}
      <button class="btn ghost xs" type="button" data-action="holdem-clear" ${more ? '' : 'disabled'}>Effacer</button>
      <button class="btn hd-go" type="button" data-action="holdem-bet" ${p.move ? '' : 'disabled'}>${p.label}</button></div>`;
}

export function holdemTableHtml(c: HoldemCtx) {
  const { g, me } = c, name = (s: string) => (s === me ? 'Toi' : c.who(s).name), crown = leaders(c);
  const left = g.settings.every ? g.settings.every - ((g.hand - 1) % g.settings.every) : 0;
  const info = g.over ? `Partie terminée · ${g.hand} main${g.hand > 1 ? 's' : ''}` : `${g.turn ? `${g.turn === me ? '<b>À toi de parler</b>' : `À ${esc(name(g.turn))} de parler`} · main` : 'Main'} ${g.hand} · <span title="Blindes ${fmt(g.sb)} / ${fmt(g.bb)}${left ? ` : elles montent dans ${left} main${left > 1 ? 's' : ''}` : ' (fixes)'}">blindes ${fmt(g.sb)} / ${fmt(g.bb)}${left === 1 ? ' (dernière main)' : ''}</span>`;
  const others = g.seats.filter(s => s !== me).map(s => seatHtml(c, s, crown)).join('');

  let middle: string, text: string;
  if (g.over) {
    const order = [...g.seats].sort((a, b) => (g.places[a] ?? 99) - (g.places[b] ?? 99));
    middle = `<div class="cg-results hd-results"><h3>${order[0] === me ? 'Tu gagnes' : `${esc(name(order[0]!))} gagne`} la partie</h3><ol>${order.map(s => {
      const p = c.who(s), pts = H.placePoints(g.places[s] ?? g.seats.length, g.seats.length);
      return `<li class="${p.bot ? 'is-bot' : ''}"><span class="rank-n">${g.places[s]}</span><span class="dot" style="--c:${p.color}"></span>${seatLabel({ ...p, name: name(s) }, 'res-name')}
        <span class="pts" ${p.bot ? 'title="Un robot : pas de points"' : ''}>${p.bot ? '—' : `+${pts}`}</span></li>`;
    }).join('')}</ol>${c.host ? '<button class="btn" type="button" data-action="cards-deal">Nouvelle partie</button>' : '<p class="note">L\'hôte lance la partie suivante.</p>'}</div>`;
    text = 'Points : 10 × (places − sa place)';
  } else {
    middle = `${potHtml(c)}${boardHtml(c)}`;
    const r = g.result;
    const takes = (ws: string[], amount: number) => (ws.length > 1 ? `${ws.map(w => esc(name(w))).join(' et ')} se partagent ${fmt(amount)}` : ws[0] === me ? `Tu remportes ${fmt(amount)}` : `${esc(name(ws[0]!))} remporte ${fmt(amount)}`);
    text = g.street === 'showdown' && r ? (c.pay ? (r.uncontested ? 'Les autres se sont couchés' : 'Abattage : les mains sont retournées')
      : r.uncontested ? `${takes(r.awards[0]!.winners, r.awards[0]!.amount)} : les autres se sont couchés`
      : r.awards.map(a => `${takes(a.winners, a.amount)} avec ${esc(a.hand.charAt(0).toLowerCase() + a.hand.slice(1))}`).join(' · '))
      : g.revealed ? 'Tapis : plus personne ne peut miser, les cartes sortent'
      : `${STREETS[g.street]}${g.current ? ` · mise à suivre ${fmt(g.current)}` : ''}`;
  }

  const myself = c.playing && me && g.seats.includes(me);
  const myTurn = !!H.options(g, me);
  const meBox = myself ? (() => {
    const p = c.who(me), won = c.pay ? 0 : g.result?.won[me] ?? 0;
    return `<div class="hd-me ${g.turn === me ? 'is-turn' : ''} ${g.folded.includes(me) || g.out.includes(me) ? 'is-out' : ''}" data-seat="${esc(me)}" style="--c:${p.color}">
      <div class="hd-hole">${crown.has(me) ? CROWN : ''}${g.inHand.includes(me) && !g.folded.includes(me) ? holeCards(c, me, true) : '<span class="hd-none">—</span>'}</div>
      <div class="hd-mine"><div class="hd-mine-top"><span class="hd-stack big" title="Ta banque">${fmt(bank(c, me) - (myTurn ? c.pending.reduce((x, y) => x + y, 0) : 0))}</span>${badges(g, me)}
        ${won ? `<span class="hd-won">+${fmt(won)}</span>` : ''}
        ${g.result?.best[me] && showdown(g) && !c.pay ? `<small class="hd-hand">${esc(g.result.best[me]!.name)}</small>` : ''}</div>
        ${g.out.includes(me) ? '' : rackHtml(c, myTurn)}</div></div>`;
  })() : '';
  const watch = myself ? '' : `<div class="cg-watch"><p class="note">Tu regardes la partie. ${c.seats.mine ? 'Un robot joue ta place depuis que tu as quitté la table : reprends-la avec ses jetons.'
      : c.seats.free ? `${c.seats.free} place${c.seats.free > 1 ? 's' : ''} en jeu ${c.seats.free > 1 ? 'sont jouées' : 'est jouée'} par un robot : prends-en une, avec ses jetons ; ta place à la fin de la partie te donne des points.` : `Toutes les places en jeu sont prises par des joueurs.`}</p>
    <button class="btn cg-join ${c.seats.full ? 'is-error' : ''}" type="button" data-action="table-join">${icon.users}${c.seats.full ? `Table complète (${c.seats.total}/${c.seats.total})` : c.seats.mine ? 'Reprendre ma place' : c.seats.free ? `Prendre la place de ${esc(c.seats.takes)}` : 'Rejoindre la partie'}</button></div>`;
  return `<div class="cards-game holdem ${g.turn === me ? 'my-turn' : ''}">${head('Texas Hold\'em', info)}
    <div class="cg-table hd-table ${g.seats.length - (myself ? 1 : 0) >= 4 ? 'is-many' : ''}"><ul class="cg-seats" style="--cols:${seatCols(g.seats.length - (g.seats.includes(me) ? 1 : 0))}">${others}</ul><div class="cg-pile hd-middle" data-pile>${middle}</div>${g.over || g.revealed ? `<p class="cg-pile-text">${text}</p>` : ''}
      ${myself && !g.over ? betSpot(me, g.bets[me] ?? 0, myTurn ? c.pending : [], 'mine', g.result ? '' : actBadge(g, me)) : ''}</div>
    <div class="cg-me">${meBox}${myself ? `${!g.over ? actionsHtml(c) : ''}<button class="btn ghost sm cg-leave" type="button" data-action="table-leave" title="Un robot joue ta place à ta place, avec tes jetons ; ta place à la fin reste la tienne">Quitter la table</button>` : watch}</div></div>`;
}

// ------------------------------------------------------------------ announcements (over the table)
export const levelAnnounce = (sb: number, bb: number) => `<div class="announce-box take"><small>Nouveau niveau</small>Les blindes montent<span class="ann-bid">${fmt(sb)} / ${fmt(bb)}</span></div>`;
export const outAnnounce = (name: string, place: number, me = false) => `<div class="announce-box take"><small>${me ? 'Tu es éliminé' : 'Éliminé'}</small>${esc(name)}<span class="ann-bid">${placeName(place)} place</span></div>`;
export const winAnnounce = (name: string, me = false) => `<div class="announce-box take"><small>Fin de la partie</small>${me ? 'Tu gagnes' : `${esc(name)} gagne`}<span class="ann-bid">1re place</span></div>`;
/** The hand's end, in the foreground: for a pot, who takes it and how much, his two cards + the board, the 5 cards of
 *  his hand brought forward, its name (also when the others folded). */
export function handAnnounce(g: G, award: { amount: number; winners: string[]; hand: string; side: number }, name: (s: string) => string, me: string, pots: number) {
  const r = g.result!, five = new Set(r.best[award.winners[0]!]?.five ?? []), cls = (cd: C) => (five.has(cd.id) ? 'is-best' : 'is-dim');
  const card = (cd: C) => `<span class="hd-win-card ${cls(cd)}">${holdemCard(cd)}</span>`;
  const who = award.winners.length > 1 ? `${award.winners.map(w => esc(name(w))).join(' et ')} se partagent` : award.winners[0] === me ? 'Tu remportes' : `${esc(name(award.winners[0]!))} remporte`;
  return `<div class="announce-box hd-win"><small>${r.uncontested ? 'Les autres se sont couchés' : pots > 1 ? (award.side ? `Pot annexe${pots > 2 ? ` ${award.side}` : ''}` : 'Pot principal') : 'Abattage'}</small>
    <span>${who} <b class="hd-win-amount">${fmt(award.amount)}</b></span>
    <div class="hd-win-cards">${award.winners.map(w => `<span class="hd-win-hole">${(g.holes[w] ?? []).filter(cd => cd.r).map(card).join('')}</span>`).join('<span class="hd-win-plus">·</span>')}
      ${g.board.length ? `<span class="hd-win-plus">+</span><span class="hd-win-board">${g.board.map(card).join('')}</span>` : '<small class="hd-win-none">avant le flop : ses deux cartes seules</small>'}</div>
    <span class="ann-bid">${esc(award.hand || r.best[award.winners[0]!]?.name || '')}</span></div>`;
}
export const allinAnnounce = (name: string, amount: number) => `<div class="announce-box take hd-allin"><small>Tapis</small>${esc(name)}<span class="ann-bid">${fmt(amount)}</span></div>`;

// ------------------------------------------------------------------ the rules
const c = (id: string) => H.card(id);
const row = (ids: string) => `<span class="rule-cards">${ids.split(' ').map(id => holdemCard(c(id), 'small')).join('')}</span>`;
const HANDS: [string, string, string][] = [
  ['Quinte flush royale', 'S14 S13 S12 S11 S10', 'As, Roi, Dame, Valet, 10 de la même couleur : imbattable'],
  ['Quinte flush', 'H9 H8 H7 H6 H5', 'Cinq cartes qui se suivent, de la même couleur'],
  ['Carré', 'C12 D12 H12 S12 D3', 'Quatre cartes de même valeur'],
  ['Full', 'S10 H10 D10 C4 S4', 'Un brelan et une paire (« full aux 10 par les 4 »)'],
  ['Couleur', 'D13 D10 D8 D4 D2', 'Cinq cartes de la même couleur, qui ne se suivent pas'],
  ['Quinte', 'C9 D8 S7 H6 C5', 'Cinq cartes qui se suivent ; l\'As compte aussi pour 1 : 5-4-3-2-A'],
  ['Brelan', 'H7 S7 D7 C13 S2', 'Trois cartes de même valeur'],
  ['Double paire', 'S11 D11 C4 H4 S14', 'Deux paires'],
  ['Paire', 'H14 C14 S9 D6 H3', 'Deux cartes de même valeur'],
  ['Hauteur', 'S13 D11 H8 C5 S3', 'Rien de tout ça : la plus haute carte compte (« hauteur Roi »)'],
];

export function holdemRulesHtml() {
  return rulesFrame('Texas Hold\'em — les règles', `
    <section><h3>But</h3><p>Une partie se joue en <b>tournoi</b> avec des <b>jetons fictifs</b> : tout le monde commence avec la même banque ; qui n'a plus de jetons est <b>éliminé</b> ; le dernier à en avoir gagne. Chaque main, on remporte le <b>pot</b> (toutes les mises) avec la meilleure combinaison, ou parce que les autres se sont couchés. La plus grosse banque porte la couronne 👑.</p>
      <p class="note">Points au classement selon la place : 10 × (nombre de places − sa place). À 6 : le 1er +50, le 2e +40… le dernier 0. Les robots ne marquent pas.</p></section>
    <section><h3>Les jetons</h3><p class="hd-rule-chips">${H.CHIP_VALUES.map(v => `<span>${chipSvg(v)}<b>${fmt(v)}</b><small>${CHIP_LOOK[v]!.name}</small></span>`).join('')}</p>
      <p>À ton tour, <b>clique tes jetons</b> : ils s'ajoutent à ta mise, sous ta place ; « Relancer à … » la confirme, « Effacer » la reprend. Ou utilise les boutons : se coucher, parler, suivre, tapis, et les raccourcis min, ½ pot, pot.</p>
      <p class="note">Les mises de chacun restent devant lui pendant le tour, puis glissent au pot ; à la fin de la main, le pot part au gagnant.</p></section>
    <section><h3>Une main</h3><p>Chacun reçoit <b>2 cartes cachées</b>. Puis viennent, entre quatre tours de mises, les <b>cartes communes</b> au milieu, pour tous :</p>
      <div class="rule-example"><span class="rule-arrow">Ta main</span>${row('S14 H13')}<span class="rule-arrow">flop</span>${row('D14 C7 S2')}<span class="rule-arrow">turn</span>${row('H9')}<span class="rule-arrow">river</span>${row('C13')}</div>
      <p>À l'abattage, chacun fait sa <b>meilleure combinaison de 5 cartes</b> parmi ses 2 et les 5 communes (même sans utiliser les siennes). Ici : double paire, As et Rois.</p></section>
    <section><h3>Le bouton et les blindes</h3><p>Le <b class="hd-pos dealer">D</b> (le bouton, le donneur) avance d'une place à chaque main. À sa gauche, la <b class="hd-pos">PB</b> (petite blinde) et la <b class="hd-pos">GB</b> (grosse blinde) misent d'office avant de voir leurs cartes : il y a toujours quelque chose à gagner.</p>
      <p>Avant le flop, le joueur à gauche de la grosse blinde parle le premier, la grosse blinde la dernière. Après, le premier joueur à gauche du bouton. <b>À deux</b>, le bouton est la petite blinde : il parle le premier avant le flop, le dernier ensuite.</p></section>
    <section><h3>Parler</h3><ol class="rule-roles">
      <li><span class="role-badge">Se coucher</span><span>abandonner la main (et ce qu'on a déjà misé)</span><b></b></li>
      <li><span class="role-badge">Parler</span><span>ne rien miser, quand personne n'a misé ce tour-ci</span><b></b></li>
      <li><span class="role-badge">Suivre</span><span>mettre autant que la plus grosse mise</span><b></b></li>
      <li><span class="role-badge">Miser / Relancer</span><span>mettre plus : les autres devront suivre</span><b></b></li>
      <li><span class="role-badge">Tapis</span><span>miser tous ses jetons</span><b></b></li></ol>
      <p><b>No Limit</b> : on peut miser jusqu'à toute sa banque. Une relance vaut au moins la relance précédente : blindes 10 / 20, Zoé relance à 60 (+40) → la suivante au moins à 100 (+40). La première mise d'un tour : au moins la grosse blinde.</p>
      <p class="note">Un tapis plus petit qu'une relance complète ne rouvre pas les enchères : ceux qui avaient déjà parlé suivent ou se couchent.</p></section>
    <section><h3>Les combinaisons, de la plus forte à la plus faible</h3><ol class="hd-ranks">${HANDS.map(([n, ids, help], i) => `<li><span class="rank-n">${i + 1}</span><span class="hd-rank-name"><b>${n}</b><small>${help}</small></span>${row(ids)}</li>`).join('')}</ol>
      <p>À combinaison égale, la plus haute gagne (paire d'As contre paire de Rois), puis les cartes restantes, les <b>kickers</b> :</p>
      <div class="rule-example">${row('S14 H14 D13 C9 S4')}<span class="rule-arrow ok">bat</span>${row('D14 C14 H12 S9 D4')}<span class="rule-arrow">le Roi contre la Dame</span></div>
      <p class="note">Les couleurs ne départagent jamais : à égalité parfaite, le pot est partagé (le jeton de 5 en trop au premier gagnant à gauche du bouton).</p></section>
    <section><h3>Tapis et pots annexes</h3><p>Un joueur à tapis ne peut gagner que ce qu'il a pu suivre de chaque adversaire. Le reste forme un <b>pot annexe</b>, joué entre les autres.</p>
      <p class="note">Exemple : Léa (300 jetons) fait tapis, Malo et Zoé suivent puis misent encore 400 chacun. Pot principal 900 (Léa, Malo, Zoé), pot annexe 800 (Malo et Zoé). Léa a la meilleure main, Malo la deuxième : 900 pour Léa, 800 pour Malo.</p>
      <p>Quand plus personne ne peut miser, les mains sont retournées et les cartes communes sortent jusqu'au bout.</p></section>
    <section><h3>Les blindes montent</h3><p>Selon le réglage de l'hôte, toutes les 5, 10 ou 20 mains : 10 / 20, 20 / 40, 30 / 60, 40 / 80, 60 / 120, 80 / 160, 100 / 200, 150 / 300… La partie accélère, les banques courtes doivent oser.</p>
      <p class="note">Une mise que personne n'a suivie revient à son joueur. Un joueur seul en jeu (les autres couchés) gagne sans abattage ; ses cartes sont quand même montrées à la fin, pour comprendre la main.</p></section>`);
}

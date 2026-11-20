// The Texas Hold'em's table (openspec: card-games, Texas Hold'em): the seats around (chips, bet of the round, last
// action, the button and the blinds, their cards — backs, or turned over at the showdown), the board and the pot in
// the middle, my two cards with what I hold, the betting bar that says the amounts; the showdown (hands turned over,
// the winning 5 cards brought forward, the pots and who took them), the game's places; the rules with the hands drawn.
import { backSvg, faceSvg, head, rulesFrame, seatLabel } from './cards';
import { avatarHtml, esc } from './html';
import { icon } from './icons';
import { Holdem as H } from '@slopesque/engines';

type G = H.Holdem; type C = H.HCard;

export const fmt = (n: number) => n.toLocaleString('fr-FR');
export const holdemCard = (c: C, cls = '') => faceSvg(H.rankLabel(c.r), c.s, H.cardName(c), cls);
const STREETS: Record<H.Street, string> = { preflop: 'Avant le flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Abattage' };
const ACTS: Record<H.Act, string> = { fold: 'Couché', check: 'Parole', call: 'Suit', bet: 'Mise', raise: 'Relance à', allin: 'Tapis', sb: 'Petite blinde', bb: 'Grosse blinde' };
const actLabel = (a: { act: H.Act; amount: number }) => (a.act === 'fold' || a.act === 'check' || a.act === 'allin' ? ACTS[a.act] : `${ACTS[a.act]} ${fmt(a.amount)}`);
const placeName = (p: number) => (p === 1 ? '1re' : `${p}e`);

export interface HoldemCtx {
  g: G;
  me: string;                       // my seat ('' : watching)
  playing: boolean;
  host: boolean;
  who: (id: string) => { name: string; color: string; bot?: boolean; photo?: string | null };
  fresh: Set<string>;               // the cards just dealt or turned over (board ids, « seat:i » for the hole cards): their animation
  raise: number;                    // the amount chosen for a bet / raise (its total)
  late: { seat: string; secs: number; vote: boolean } | null;
  seats: { free: number; total: number; mine: boolean; takes: string; full: boolean };
}

/** The sizes of a raise: the minimum, half the pot, the pot (after calling), all-in. */
export function sizes(g: G, me: string) {
  const o = H.options(g, me);
  if (!o?.raise) return null;
  const owe = o.call, pot = H.pot(g), clamp = (x: number) => Math.min(o.raise!.max, Math.max(o.raise!.min, Math.round(x / 5) * 5));
  return { min: o.raise.min, half: clamp(g.current + (pot + owe) / 2), pot: clamp(g.current + pot + owe), max: o.raise.max };
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

function holeCards(g: G, s: string, c: HoldemCtx, big: boolean) {
  const best = g.result?.best[s]?.five ?? [], showdown = g.street === 'showdown' && !!g.result && !g.result.uncontested;
  return (g.holes[s] ?? []).map((cd, i) => {
    const cls = `${c.fresh.has(`${s}:${i}`) ? (cd.r ? 'is-turned' : 'is-dealt') : ''} ${showdown && cd.r ? (best.includes(cd.id) && winners(g).includes(s) ? 'is-best' : 'is-dim') : ''}`;
    return `<span class="hd-card ${big ? 'pcard' : 'mini'} ${cls}" style="--i:${i}" data-card="${cd.r ? cd.id : ''}">${cd.r ? holdemCard(cd) : backSvg()}</span>`;
  }).join('');
}
const winners = (g: G) => g.result?.awards.flatMap(a => a.winners) ?? [];

function badges(g: G, s: string) {
  const pos = s === g.button ? '<b class="hd-pos dealer" title="Le bouton : le donneur de cette main">D</b>' : '';
  const blind = g.street !== 'showdown' || !g.over ? (s === g.sbSeat ? '<b class="hd-pos" title="Petite blinde">PB</b>' : s === g.bbSeat ? '<b class="hd-pos" title="Grosse blinde">GB</b>' : '') : '';
  return pos + blind;
}

function seatHtml(g: G, s: string, c: HoldemCtx) {
  const p = c.who(s), out = g.out.includes(s), folded = g.folded.includes(s), last = g.last[s], won = g.result?.won[s] ?? 0, bet = g.bets[s] ?? 0;
  const late = c.late?.seat === s ? c.late : null;
  const state = out ? `<span class="seat-state">éliminé · ${placeName(g.places[s] ?? 0)}</span>`
    : won ? `<span class="hd-won">+${fmt(won)}</span>` : last && last.act !== 'sb' && last.act !== 'bb' ? `<span class="hd-act act-${last.act}">${actLabel(last)}</span>` : '';
  const hand = g.result?.best[s] && g.street === 'showdown' && !g.result.uncontested ? `<small class="hd-hand">${esc(g.result.best[s]!.name)}</small>` : '';
  return `<li class="cg-seat hd-seat ${g.turn === s ? 'is-turn' : ''} ${late ? 'is-late' : ''} ${folded || out ? 'is-out' : ''} ${won ? 'is-winner' : ''}" data-seat="${esc(s)}" style="--c:${p.color}">
    ${avatarHtml(p.name, p.color, p.bot ? null : p.photo)}<span class="hd-who">${seatLabel(p)}<span class="hd-stack" title="Jetons devant lui">${chip()}${fmt(g.stacks[s] ?? 0)}</span></span>${badges(g, s)}
    ${out || !g.inHand.includes(s) || folded ? '' : `<span class="hd-holes">${holeCards(g, s, c, false)}</span>`}${state}${hand}
    ${bet && g.street !== 'showdown' ? `<span class="hd-bet" title="Sa mise de ce tour">${chip()}${fmt(bet)}</span>` : ''}
    ${late ? (late.vote ? '<span class="seat-state">vote en cours</span>' : `<button class="seat-kick" type="button" data-action="kick" title="Son tour dure depuis ${late.secs} s : proposer au vote qu'un robot joue à sa place (comme /kick)">${icon.kick}Exclure ?</button>`) : ''}</li>`;
}
const chip = () => '<i class="hd-chip" aria-hidden="true"></i>';

function boardHtml(g: G, c: HoldemCtx) {
  const best = g.result && !g.result.uncontested ? g.result.best[g.result.awards[0]?.winners[0] ?? '']?.five ?? [] : [];
  const showdown = g.street === 'showdown' && !!g.result && !g.result.uncontested;
  let k = 0;
  const slots = Array.from({ length: 5 }, (_, i) => {
    const cd = g.board[i];
    if (!cd) return '<span class="hd-slot" aria-hidden="true"></span>';
    const isNew = c.fresh.has(cd.id);
    return `<span class="pcard hd-card on-table ${isNew ? 'is-turned' : ''} ${showdown ? (best.includes(cd.id) ? 'is-best' : 'is-dim') : ''}" style="--i:${isNew ? k++ : 0}" data-card="${cd.id}">${holdemCard(cd)}</span>`;
  }).join('');
  return `<div class="hd-board" title="Les cartes communes : chacun les utilise avec ses deux cartes">${slots}</div>`;
}

function potHtml(g: G, c: HoldemCtx) {
  if (g.street === 'showdown' && g.result) {
    const name = (s: string) => (s === c.me ? 'Toi' : c.who(s).name);
    const lines = g.result.awards.map(a => `<li>${chip()}<b>${fmt(a.amount)}</b>${g.result!.awards.length > 1 ? ` <small>${a.side ? `pot annexe${g.result!.awards.length > 2 ? ` ${a.side}` : ''}` : 'pot principal'}</small>` : ''}
      → <b>${a.winners.map(w => esc(name(w))).join(' et ')}</b>${a.winners.length > 1 ? ' (partagé)' : ''}${a.hand ? ` · ${esc(a.hand)}` : ''}</li>`).join('');
    return `<ul class="hd-awards">${lines}</ul>`;
  }
  const pot = H.pot(g), live = g.inHand.filter(s => !g.folded.includes(s)), top = Math.max(0, ...live.map(s => g.paid[s] ?? 0));
  const side = new Set(live.filter(s => g.stacks[s] === 0 && (g.paid[s] ?? 0) < top).map(s => g.paid[s])).size;   // an all-in for less: a side pot above it
  return `<p class="hd-pot" title="Toutes les mises de la main">${chip()}Pot <b>${fmt(pot)}</b>${side ? ` <small>dont ${side} pot${side > 1 ? 's' : ''} annexe${side > 1 ? 's' : ''}</small>` : ''}</p>`;
}

/** The betting bar: fold, check or call (the amount), a bet / raise (its sizes, a slider, the amount), all-in. */
function actionsHtml(g: G, c: HoldemCtx) {
  const o = H.options(g, c.me);
  const mine = holding(g, c.me);
  const hold = mine ? `<span class="hd-holding" title="Ta meilleure combinaison avec les cartes communes">Tu as : <b>${esc(mine)}</b></span>` : '';
  if (!o) {
    const why = g.over ? '' : g.out.includes(c.me) ? `Éliminé : ${placeName(g.places[c.me] ?? 0)} place. Tu regardes la fin de la partie.` : g.folded.includes(c.me) ? 'Couché : attends la main suivante.'
      : g.street === 'showdown' ? 'Main suivante dans un instant…' : g.inHand.includes(c.me) && (g.stacks[c.me] ?? 0) === 0 ? 'Tapis : les cartes vont parler.' : 'Attends ton tour…';
    return `<div class="cg-actions hd-actions">${hold}<span class="cg-hint">${why}</span></div>`;
  }
  const z = sizes(g, c.me), raise = z ? Math.min(z.max, Math.max(z.min, c.raise || z.min)) : 0, bet0 = g.current === 0;
  const callLabel = o.check ? 'Parler' : o.call >= (g.stacks[c.me] ?? 0) ? `Suivre — tapis ${fmt(o.call)}` : `Suivre ${fmt(o.call)}`;
  const raiseBox = z ? `<div class="hd-raise">
      <div class="hd-sizes">${[['Min', z.min], ['½ pot', z.half], ['Pot', z.pot], ['Tapis', z.max]].map(([l, v]) => `<button class="btn ghost xs" type="button" data-action="holdem-size" data-v="${v}" ${v === raise ? 'aria-pressed="true"' : ''}>${l}</button>`).join('')}</div>
      <input class="hd-range" type="range" data-hd="raise" min="${z.min}" max="${z.max}" step="${Math.max(1, Math.min(g.bb / 2, z.max - z.min))}" value="${raise}" aria-label="Montant de la ${bet0 ? 'mise' : 'relance'}">
      <button class="btn hd-go" type="button" data-action="holdem-raise" data-raise-label>${raise >= z.max ? `Tapis ${fmt(z.max)}` : `${bet0 ? 'Miser' : 'Relancer à'} ${fmt(raise)}`}</button></div>`
    : o.allin && o.allin > g.current ? `<button class="btn" type="button" data-action="holdem-allin">Tapis ${fmt(o.allin)}</button>` : '';
  return `<div class="cg-actions hd-actions is-mine">${hold}
    <button class="btn ghost" type="button" data-action="holdem-fold" ${o.check ? 'title="Tu peux parler sans rien payer"' : ''}>Se coucher</button>
    <button class="btn" type="button" data-action="${o.check ? 'holdem-check' : 'holdem-call'}">${callLabel}</button>${raiseBox}</div>`;
}

export function holdemTableHtml(c: HoldemCtx) {
  const { g, me } = c, name = (s: string) => (s === me ? 'Toi' : c.who(s).name);
  const left = g.settings.every ? g.settings.every - ((g.hand - 1) % g.settings.every) : 0;
  const info = g.over ? `Partie terminée · ${g.hand} main${g.hand > 1 ? 's' : ''}` : `${g.turn ? `${g.turn === me ? '<b>À toi de parler</b>' : `À ${esc(name(g.turn))} de parler`} · main` : 'Main'} ${g.hand} · <span title="Blindes ${fmt(g.sb)} / ${fmt(g.bb)}${left ? ` : elles montent dans ${left} main${left > 1 ? 's' : ''}` : ' (fixes)'}">blindes ${fmt(g.sb)} / ${fmt(g.bb)}${left === 1 ? ' (dernière main)' : ''}</span>`;
  const others = g.seats.filter(s => s !== me).map(s => seatHtml(g, s, c)).join('');

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
    middle = `${potHtml(g, c)}${boardHtml(g, c)}`;
    const r = g.result;
    const takes = (ws: string[], amount: number) => (ws.length > 1 ? `${ws.map(w => esc(name(w))).join(' et ')} se partagent ${fmt(amount)}` : ws[0] === me ? `Tu remportes ${fmt(amount)}` : `${esc(name(ws[0]!))} remporte ${fmt(amount)}`);
    text = g.street === 'showdown' && r ? (r.uncontested ? `${takes(r.awards[0]!.winners, r.awards[0]!.amount)} : les autres se sont couchés`
      : r.awards.map(a => `${takes(a.winners, a.amount)} avec ${esc(a.hand.charAt(0).toLowerCase() + a.hand.slice(1))}`).join(' · '))
      : g.revealed ? 'Tapis : plus personne ne peut miser, les cartes sortent'
      : `${STREETS[g.street]}${g.current ? ` · mise à suivre ${fmt(g.current)}` : ''}`;
  }

  const myself = c.playing && me && g.seats.includes(me);
  const meBox = myself ? (() => {
    const p = c.who(me), won = g.result?.won[me] ?? 0, last = g.last[me], bet = g.bets[me] ?? 0;
    return `<div class="hd-me ${g.turn === me ? 'is-turn' : ''} ${g.folded.includes(me) || g.out.includes(me) ? 'is-out' : ''}" data-seat="${esc(me)}" style="--c:${p.color}">
      <div class="hd-hole">${g.inHand.includes(me) && !g.folded.includes(me) ? holeCards(g, me, c, true) : '<span class="hd-none">—</span>'}</div>
      <div class="hd-mine"><span class="hd-stack big" title="Tes jetons">${chip()}${fmt(g.stacks[me] ?? 0)}</span>${badges(g, me)}
        ${won ? `<span class="hd-won">+${fmt(won)}</span>` : last && last.act !== 'sb' && last.act !== 'bb' ? `<span class="hd-act act-${last.act}">${actLabel(last)}</span>` : ''}
        ${bet && g.street !== 'showdown' ? `<span class="hd-bet">${chip()}${fmt(bet)}</span>` : ''}
        ${g.result?.best[me] && g.street === 'showdown' && !g.result.uncontested ? `<small class="hd-hand">${esc(g.result.best[me]!.name)}</small>` : ''}</div></div>`;
  })() : '';
  const watch = myself ? '' : `<div class="cg-watch"><p class="note">Tu regardes la partie. ${c.seats.mine ? 'Un robot joue ta place depuis que tu as quitté la table : reprends-la avec ses jetons.'
      : c.seats.free ? `${c.seats.free} place${c.seats.free > 1 ? 's' : ''} en jeu ${c.seats.free > 1 ? 'sont jouées' : 'est jouée'} par un robot : prends-en une, avec ses jetons ; ta place à la fin de la partie te donne des points.` : `Toutes les places en jeu sont prises par des joueurs.`}</p>
    <button class="btn cg-join ${c.seats.full ? 'is-error' : ''}" type="button" data-action="table-join">${icon.users}${c.seats.full ? `Table complète (${c.seats.total}/${c.seats.total})` : c.seats.mine ? 'Reprendre ma place' : c.seats.free ? `Prendre la place de ${esc(c.seats.takes)}` : 'Rejoindre la partie'}</button></div>`;
  return `<div class="cards-game holdem ${g.turn === me ? 'my-turn' : ''}">${head('Texas Hold\'em', info)}
    <div class="cg-table hd-table"><ul class="cg-seats">${others}</ul><div class="cg-pile hd-middle" data-pile>${middle}</div><p class="cg-pile-text">${text}</p></div>
    <div class="cg-me">${meBox}${myself ? `${!g.over ? actionsHtml(g, c) : ''}<button class="btn ghost sm cg-leave" type="button" data-action="table-leave" title="Un robot joue ta place à ta place, avec tes jetons ; ta place à la fin reste la tienne">Quitter la table</button>` : watch}</div></div>`;
}

// ------------------------------------------------------------------ announcements (over the table)
export const levelAnnounce = (sb: number, bb: number) => `<div class="announce-box take"><small>Nouveau niveau</small>Les blindes montent<span class="ann-bid">${fmt(sb)} / ${fmt(bb)}</span></div>`;
export const outAnnounce = (name: string, place: number, me = false) => `<div class="announce-box take"><small>${me ? 'Tu es éliminé' : 'Éliminé'}</small>${esc(name)}<span class="ann-bid">${placeName(place)} place</span></div>`;
export const winAnnounce = (name: string, me = false) => `<div class="announce-box take"><small>Fin de la partie</small>${me ? 'Tu gagnes' : `${esc(name)} gagne`}<span class="ann-bid">1re place</span></div>`;
export const allinAnnounce = (name: string, amount: number) => `<div class="announce-box take hd-allin"><small>Tapis</small>${esc(name)}<span class="ann-bid">${fmt(amount)}</span></div>`;

// ------------------------------------------------------------------ the rules
const c = (id: string) => H.card(id);
const row = (ids: string, mark = '') => {
  const marked = new Set(mark.split(' ').filter(Boolean));
  return `<span class="rule-cards">${ids.split(' ').map(id => `<span class="${marked.size && !marked.has(id) ? 'rule-off' : ''}">${holdemCard(c(id), 'small')}</span>`).join('')}</span>`;
};
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
  ['Carte haute', 'S13 D11 H8 C5 S3', 'Rien de tout ça : la plus haute carte compte'],
];

export function holdemRulesHtml() {
  return rulesFrame('Texas Hold\'em — les règles', `
    <section><h3>But</h3><p>Une partie se joue en <b>tournoi</b> avec des <b>jetons fictifs</b> : tout le monde commence avec le même tapis ; qui n'a plus de jetons est <b>éliminé</b> ; le dernier à en avoir gagne. Chaque main, on remporte le <b>pot</b> (toutes les mises) avec la meilleure combinaison, ou parce que les autres se sont couchés.</p>
      <p class="note">Points au classement selon la place : 10 × (nombre de places − sa place). À 6 : le 1er +50, le 2e +40… le dernier 0. Les robots ne marquent pas.</p></section>
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
      <p><b>No Limit</b> : on peut miser jusqu'à tout son tapis. Une relance vaut au moins la relance précédente : blindes 10 / 20, Zoé relance à 60 (+40) → la suivante au moins à 100 (+40). La première mise d'un tour : au moins la grosse blinde.</p>
      <p class="note">Un tapis plus petit qu'une relance complète ne rouvre pas les enchères : ceux qui avaient déjà parlé suivent ou se couchent.</p></section>
    <section><h3>Les combinaisons, de la plus forte à la plus faible</h3><ol class="hd-ranks">${HANDS.map(([n, ids, help], i) => `<li><span class="rank-n">${i + 1}</span><span class="hd-rank-name"><b>${n}</b><small>${help}</small></span>${row(ids)}</li>`).join('')}</ol>
      <p>À combinaison égale, la plus haute gagne (paire d'As contre paire de Rois), puis les cartes restantes, les <b>kickers</b> :</p>
      <div class="rule-example">${row('S14 H14 D13 C9 S4')}<span class="rule-arrow ok">bat</span>${row('D14 C14 H12 S9 D4')}<span class="rule-arrow">le Roi contre la Dame</span></div>
      <p class="note">Les couleurs ne départagent jamais : à égalité parfaite, le pot est partagé (le jeton impair au premier gagnant à gauche du bouton).</p></section>
    <section><h3>Tapis et pots annexes</h3><p>Un joueur à tapis ne peut gagner que ce qu'il a pu suivre de chaque adversaire. Le reste forme un <b>pot annexe</b>, joué entre les autres.</p>
      <p class="note">Exemple : Léa (300 jetons) fait tapis, Malo et Zoé suivent puis misent encore 400 chacun. Pot principal 900 (Léa, Malo, Zoé), pot annexe 800 (Malo et Zoé). Léa a la meilleure main, Malo la deuxième : 900 pour Léa, 800 pour Malo.</p>
      <p>Quand plus personne ne peut miser, les mains sont retournées et les cartes communes sortent jusqu'au bout.</p></section>
    <section><h3>Les blindes montent</h3><p>Selon le réglage de l'hôte, toutes les 5, 10 ou 20 mains : 10 / 20, 20 / 40, 30 / 60, 40 / 80, 60 / 120, 80 / 160, 100 / 200, 150 / 300… La partie accélère, les tapis courts doivent oser.</p>
      <p class="note">Une mise que personne n'a suivie revient à son joueur. Un joueur seul en jeu gagne sans montrer ses cartes.</p></section>`);
}

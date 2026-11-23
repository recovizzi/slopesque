// La Coinche's table (openspec: card-games, Coinche): the three other seats (my left opponent, my partner across, my
// right opponent) with their team and their word in the bidding, the score of both teams and the target, the
// contract; the trick in the middle (taken to its winner, as at the Tarot); my hand in a fan (the cards I can't play
// greyed, the trumps marked); the bidding bar (a value, a suit, pass, coinche, surcoinche); the deal's count and the
// score sheet; the rules with the cards drawn. Reuses the Tarot's trick and pile.
import { backSvg, faceSvg, handAngle, head, kickBtn, rulesFrame, seatCols, seatPill } from './cards';
import { esc } from './html';
import { Coinche as CO } from '@slopesque/engines';

type G = CO.Coinche; type C = CO.CCard; type Suit = 'S' | 'H' | 'D' | 'C';
const { CAPOT, SUIT_SIGN, SUIT_NAME, legal, options, team, partnerOf, points, round10 } = CO;
export const coincheCard = (c: C, trump: Suit | null = null, cls = '') => faceSvg(CO.rankLabel(c.r), c.s, CO.cardName(c), `${cls} ${trump && c.s === trump ? 'is-trump' : ''}`);
const sign = (s: Suit) => `<span class="co-suit ${s === 'H' || s === 'D' ? 'red' : ''}">${SUIT_SIGN[s]}</span>`;
const contractHtml = (k: { value: number; suit: Suit; mult: number }) => `${k.value === CAPOT ? 'Capot' : k.value} ${sign(k.suit)}${k.mult === 4 ? ' <b class="co-mult">surcoinché</b>' : k.mult === 2 ? ' <b class="co-mult">coinché</b>' : ''}`;

export interface CoincheCtx {
  g: G;
  me: string;                        // my seat ('' : watching)
  playing: boolean;
  host: boolean;
  selected: Set<string>;
  fan: { r: number; step: number };
  who: (id: string) => { name: string; color: string; bot?: boolean; photo?: string | null };
  showLast: boolean;                 // the trick just completed, still on the table (before it goes to its winner)
  bid: { value: number | null; suit: Suit | null };   // my bid being chosen
  wonView: string | null;            // the pile hovered: the last trick shown if it is its winner's
  late: { seat: string; secs: number; vote: boolean } | null;
}

/** The teams' names: « Nous » and « Eux » for a player, the players' names for a spectator. */
function teamNames(c: CoincheCtx) {
  const mine = c.me && c.g.seats.includes(c.me) ? team(c.g, c.me) : null;
  const names = (t: 0 | 1) => c.g.seats.filter(s => team(c.g, s) === t).map(s => c.who(s).name).join(' et ');
  return (t: 0 | 1) => (mine === null ? names(t) : t === mine ? 'Nous' : 'Eux');
}
/** A seat's last word in this deal's bidding. */
function spoke(g: G, s: string) {
  const w = [...g.speeches].reverse().find(x => x.by === s);
  if (!w) return '';
  return w.kind === 'bid' ? `<span class="role-badge co-say">${w.value === CAPOT ? 'Capot' : w.value} ${sign(w.suit)}</span>` : w.kind === 'pass' ? '<span class="role-badge co-say pass">Passe</span>'
    : `<span class="role-badge co-say coinche">${w.kind === 'coinche' ? 'Coinche !' : 'Surcoinche !'}</span>`;
}

/** The order around me: my left opponent, my partner across, my right opponent (or the seats' order, watching). */
const around = (g: G, me: string) => (g.seats.includes(me) ? [1, 2, 3].map(k => g.seats[(g.seats.indexOf(me) + k) % 4]!) : g.seats);

export function coincheTableHtml(c: CoincheCtx) {
  const { g, me } = c, trump = g.phase === 'play' || g.phase === 'done' ? g.contract?.suit ?? null : null, mine = CO.sortHand([...(g.hands[me] ?? [])], trump), myTurn = g.turn === me;
  const name = (s: string) => (s === me ? 'Toi' : c.who(s).name), tn = teamNames(c), myTeam = g.seats.includes(me) ? team(g, me) : null;
  const doing = { bid: 'parler', play: 'jouer', done: '' }[g.phase];
  const info = `Donne ${g.deal}${g.contract && g.phase !== 'bid' ? ` · ${esc(name(g.contract.by))} : ${contractHtml(g.contract)}` : ''}${g.turn ? ` · ${myTurn ? `<b>à toi de ${doing}</b>` : `à ${esc(name(g.turn))} de ${doing}`}` : ''}`;
  const seats = around(g, me).filter(s => s !== me).map(s => {
    const p = c.who(s), t = team(g, s), partner = myTeam !== null && s === partnerOf(g, me);
    const side = myTeam === null ? `t${t}` : t === myTeam ? 'us' : 'them', word = partner ? 'Partenaire' : myTeam === null ? `Équipe ${t + 1}` : 'Adversaire';
    const role = (g.phase === 'bid' ? spoke(g, s) : g.contract?.by === s ? '<span class="role-badge role-president">Preneur</span>' : '')
      + (g.belote.by === s && g.belote.said ? `<span class="role-badge co-belote">${g.belote.said > 1 ? 'Rebelote' : 'Belote'}</span>` : '');
    const sub = role || (partner || myTeam === null ? `<span class="co-team ${side}">${word}</span>` : '');   // the team: the pill's underline (the partner also named)
    return seatPill(p, { cls: `co-seat co-${side} ${g.turn === s ? 'is-turn' : ''} ${c.late?.seat === s ? 'is-late' : ''} ${c.wonView === s ? 'is-viewed' : ''}`, attrs: `data-seat="${esc(s)}" title="${esc(p.name)} · ${word}"`, sub,
      side: pileOf(g, s), extra: kickBtn(c.late?.seat === s ? c.late : null) });
  }).join('');

  // the score of both teams and the target: a drawer on the felt's left edge, opened when hovered
  const board = `<div class="co-board" tabindex="0" aria-label="Score : ${esc(tn(0))} ${g.scores[0]}, ${esc(tn(1))} ${g.scores[1]}, partie en ${g.target}"><span class="co-board-tab">Score</span>
    <div class="co-board-body"><span class="co-score ${myTeam === 1 ? 'them' : 'us'}">${esc(tn(0))} <b>${g.scores[0]}</b></span>
    <span class="co-score ${myTeam === 1 ? 'us' : 'them'}">${esc(tn(1))} <b>${g.scores[1]}</b></span><small>partie en ${g.target}</small></div></div>`;

  // the middle: the bidding, the trick, the count
  let pile: string, text = '';
  const row = (plays: { by: string; card: C }[], closed = false) => `<div class="tarot-trick ${closed ? 'is-closed' : ''}">${plays.map(p => `<span class="trick-card">
      <span class="pcard on-table" data-card="${p.card.id}">${coincheCard(p.card, trump)}</span><small>${esc(name(p.by))}</small></span>`).join('')}</div>`;
  if (g.phase === 'bid') {
    const k = g.contract;
    pile = `<div class="co-bidding">${k ? `<span class="co-best">${contractHtml(k)}</span><small>${esc(name(k.by))}${g.coincheBy ? ` · coinché par ${esc(name(g.coincheBy))}` : ''}</small>` : '<small>Personne n\'a encore annoncé</small>'}</div>`;
    text = g.coincheBy ? 'Coinché : les preneurs peuvent surcoincher (×4), ou passer' : 'Enchères : de 80 à 160, ou le capot, avec une couleur d\'atout — plus haut que le précédent, ou passe';
  } else if (g.phase === 'play') {
    const closed = !g.trick.length && g.lastTrick.length > 0 && c.showLast;
    pile = row(closed ? g.lastTrick : g.trick, closed);
    const lead = g.trick[0]?.card;
    text = closed ? `${esc(name(g.lastWinner!))} remporte le pli` : !g.trick.length ? `${esc(name(g.turn!))} entame` : lead!.s === trump ? 'Atout demandé : monte si tu peux'
      : `${SUIT_SIGN[lead!.s]} demandé : fournis ; sinon coupe (surcoupe, ou pisse), sauf si ton partenaire est maître`;
  } else if (g.result) {
    const r = g.result, k = r.contract, a = r.attack, d = (1 - a) as 0 | 1, bel = (t: 0 | 1) => (r.belote === t ? ' + belote 20' : '');
    const why = k.value === CAPOT ? (r.made ? 'capot réussi : 500' : 'capot manqué : 500 pour la défense')
      : r.made ? `${r.points[a]}${bel(a)} ≥ ${Math.max(k.value, 82)} : ${round10(r.points[a])} + ${k.value}${k.mult > 1 ? ` × ${k.mult}` : ''}${bel(a)}`
      : `${r.points[a]}${bel(a)} < ${Math.max(k.value, 82)} : la défense marque 160 + ${k.value}${k.mult > 1 ? ` × ${k.mult}` : ''}${bel(d)}`;
    pile = `<div class="cg-results co-results"><h3>${esc(tn(a))} ${r.made ? (tn(a) === 'Nous' ? 'remplissons' : 'remplissent') : (tn(a) === 'Nous' ? 'chutons' : 'chutent')} ${contractHtml(k)}</h3>
      <p class="note">${why}${r.capot !== null ? ' · capot : 250 points de plis' : ''}</p>
      <ol>${([a, d] as (0 | 1)[]).map(t => `<li><b>${esc(tn(t))}</b><span class="role-badge">${t === a ? 'Preneurs' : 'Défense'}</span><span>${r.points[t]} pts</span><span class="pts">+${r.score[t]}</span></li>`).join('')}</ol>
      ${sheet(g, tn)}${g.over ? `<h3 class="co-winner">${esc(tn(g.winner!))} ${tn(g.winner!) === 'Nous' ? 'gagnons' : 'gagnent'} la partie, ${Math.max(...g.scores)} à ${Math.min(...g.scores)}</h3>${c.host ? '<button class="btn" type="button" data-action="cards-deal">Nouvelle partie</button>' : '<p class="note">L\'hôte lance la partie suivante.</p>'}` : '<p class="note">Donne suivante dans un instant…</p>'}</div>`;
  } else pile = `<div class="cg-results"><h3>${esc(g.note)}</h3></div>`;

  // my hand: in the bidding to look at; in play the legal cards
  const ok = new Set((g.phase === 'play' && myTurn ? legal(g, me) : mine).map(x => x.id));
  const active = g.phase === 'play' && myTurn;
  const hand = c.playing ? `<div class="cg-hand" data-hand style="--n:${mine.length};--r:${c.fan.r}px">${mine.map((cd, i) => `<button type="button"
      class="pcard in-hand ${c.selected.has(cd.id) ? 'is-selected' : ''} ${active && !ok.has(cd.id) ? 'is-off' : ''}"
      data-action="card-pick" data-card="${cd.id}" style="--a:${handAngle(i, mine.length, c.fan.step)}rad" aria-pressed="${c.selected.has(cd.id)}">${coincheCard(cd, trump)}</button>`).join('')}</div>` : '';
  let actions: string;
  if (!c.playing) actions = `<div class="cg-watch"><p class="note">Tu regardes la partie : la Coinche se joue à 4, deux contre deux (des robots complètent les places libres). Prends la place d'un robot : sa main et les points de son équipe deviennent les tiens.</p>
    <button class="btn cg-join" type="button" data-action="table-join">Prendre une place</button></div>`;
  else if (g.phase === 'bid') {
    const o = myTurn ? options(g, me) : null;
    if (o && g.coincheBy) actions = `<div class="cg-actions co-actions"><span class="cg-hint">${esc(name(g.coincheBy))} coinche ton équipe : surcoincher (×4) ?</span>
      <button class="btn ghost" type="button" data-action="co-pass">Passer</button><button class="btn danger" type="button" data-action="co-surcoinche" ${o.surcoinche ? '' : 'disabled'}>Surcoincher</button></div>`;
    else if (o) {
      const v = c.bid.value, s = c.bid.suit, ready = v !== null && s !== null && o.values.includes(v);
      actions = `<div class="cg-actions co-actions co-values">${CO.VALUES.map(x => `<button class="btn ghost xs" type="button" data-action="co-value" data-v="${x}" ${o.values.includes(x) ? '' : 'disabled'} aria-pressed="${v === x}">${x === CAPOT ? 'Capot' : x}</button>`).join('')}</div>
        <div class="cg-actions co-actions"><span class="co-suits">${(['S', 'H', 'D', 'C'] as Suit[]).map(x => `<button class="btn ghost co-suit-btn" type="button" data-action="co-suit" data-v="${x}" aria-pressed="${s === x}" title="Atout ${SUIT_NAME[x]}">${sign(x)}</button>`).join('')}</span>
        <button class="btn ghost" type="button" data-action="co-pass">Passer</button>
        ${o.coinche ? '<button class="btn danger" type="button" data-action="co-coinche" title="L\'annonce adverse compte double ; les enchères s\'arrêtent">Coincher</button>' : ''}
        <button class="btn" type="button" data-action="co-bid" ${ready ? '' : 'disabled'}>${ready ? `Annoncer ${v === CAPOT ? 'Capot' : v} ${sign(s)}` : 'Choisis une valeur et un atout'}</button></div>`;
    } else actions = `<div class="cg-actions"><span class="cg-hint">${g.turn ? `${esc(name(g.turn))} parle…` : ''}</span></div>`;
  } else {
    const sel = mine.find(cd => c.selected.has(cd.id));
    actions = `<div class="cg-actions">${myTeam !== null && g.contract ? `<span class="role-badge co-team ${team(g, g.contract.by) === myTeam ? 'us' : 'them'}">${team(g, g.contract.by) === myTeam ? 'Nous prenons' : 'Nous défendons'}</span>` : ''}
      <span class="cg-hint">${g.phase !== 'play' ? '' : myTurn ? (sel ? `Jouer ${CO.cardName(sel)} ?` : 'Choisis une carte (les autres sont grisées)') : 'Attends ton tour…'}</span>
      <button class="btn" type="button" data-action="cards-play" ${active && sel ? '' : 'disabled'}>Jouer</button></div>`;
  }
  const myPile = c.playing && myTeam !== null ? (() => {   // my own pile (the tricks I took); the last trick when it is mine
    const n = g.tricks[me]?.length ?? 0, last = lastBy(g) === me;
    return `<div class="won-pile ${n ? '' : 'is-empty'}" ${last ? `data-won="${esc(me)}"` : ''} title="${n ? `Tes plis : ${n}${last ? ' · survoler pour revoir le dernier pli' : ''}` : 'Tes plis viendront ici'}">${n ? `${Array.from({ length: Math.min(3, n) }, (_, k) => `<span class="won-card" style="--k:${k}">${backSvg()}</span>`).join('')}<b class="won-n">${n}</b>` : ''}</div>`;
  })() : '';
  // the trump, readable under the table
  const trumpBar = g.contract && g.phase !== 'bid' ? `<div class="co-trump" title="L'atout de cette donne">Atout ${sign(g.contract.suit)}<b>${SUIT_NAME[g.contract.suit]}</b>
    <span>· ${g.contract.value === CAPOT ? 'capot' : g.contract.value} pour ${esc(name(g.contract.by))}${g.contract.mult === 4 ? ' · surcoinché' : g.contract.mult === 2 ? ' · coinché' : ''}</span></div>` : '';
  const lastView = c.wonView && c.wonView === lastBy(g) ? `<div class="tricks-view co-last"><p class="tv-head">Dernier pli, remporté par ${esc(name(c.wonView))}</p>
    <div class="tarot-trick">${g.lastTrick.map(p => `<span class="trick-card"><span class="pcard">${coincheCard(p.card, trump)}</span><small>${esc(name(p.by))}</small></span>`).join('')}</div></div>` : '';
  return `<div class="cards-game coinche ${myTurn && g.phase !== 'done' ? 'my-turn' : ''}">${head('Coinche', info)}
    <div class="cg-table"><ul class="cg-seats" style="--cols:${seatCols(around(g, me).filter(s => s !== me).length)}">${seats}</ul>${board}<div class="cg-pile" data-pile>${pile}</div><p class="cg-pile-text">${text}</p>${myPile}${lastView}</div>
    <div class="cg-me">${trumpBar}${hand}${c.playing ? '<button class="btn ghost sm cg-leave" type="button" data-action="table-leave" title="Un robot joue ta main à ta place">Quitter la table</button>' : ''}${actions}</div></div>`;
}

/** Who took the last trick (while it can be looked at again: this deal, until the count). */
const lastBy = (g: G) => (g.phase === 'play' && g.lastTrick.length ? g.lastWinner : null);
/** A player's pile of won tricks, on his pill: the cards fly there; hovered when he took the last trick: shown again. */
function pileOf(g: G, s: string) {
  const n = g.tricks[s]?.length ?? 0, last = lastBy(g) === s;
  return `<span class="co-pile ${n ? '' : 'is-empty'} ${last ? 'is-last' : ''}" data-pile-of="${esc(s)}" ${last ? `data-won="${esc(s)}"` : ''} title="${n ? `${n} pli${n > 1 ? 's' : ''}${last ? ' · survoler pour revoir le dernier pli' : ''}` : 'Aucun pli'}">${backSvg('mini')}<b>${n}</b></span>`;
}

/** The score sheet: the last deals, the contract and each team's points. */
function sheet(g: G, tn: (t: 0 | 1) => string) {
  const last = g.history.slice(-6);
  if (!last.length) return '';
  return `<table class="co-sheet"><thead><tr><th>Donne</th><th>Contrat</th><th>${esc(tn(0))}</th><th>${esc(tn(1))}</th></tr></thead><tbody>${last.map(h => `<tr><td>${h.deal}</td>
    <td>${h.contract ? contractHtml(h.contract) : 'tous passent'}</td><td>${h.score[0] ? `+${h.score[0]}` : '—'}</td><td>${h.score[1] ? `+${h.score[1]}` : '—'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td>${g.scores[0]}</td><td>${g.scores[1]}</td></tr></tfoot></table>`;
}

// ------------------------------------------------------------------ announcements (over the table)
export const contractAnnounce = (name: string, k: { value: number; suit: Suit; mult: number }) => `<div class="announce-box take"><small>Fin des enchères</small>${esc(name)} prend<span class="ann-bid">${contractHtml(k)}</span></div>`;
export const coincheAnnounce = (name: string, sur: boolean) => `<div class="announce-box take co-coinche"><small>${sur ? '×4' : '×2'}</small>${esc(name)}<span class="ann-bid">${sur ? 'Surcoinche !' : 'Coinche !'}</span></div>`;
export const beloteAnnounce = (name: string, said: number) => `<div class="announce-box take"><small>Roi et Dame d'atout : 20 points</small>${esc(name)}<span class="ann-bid">${said > 1 ? 'Rebelote !' : 'Belote !'}</span></div>`;
export const dealAnnounce = (made: boolean, k: { value: number; suit: Suit; mult: number }) => `<div class="announce-box take"><small>Fin de la donne</small>${contractHtml(k)}<span class="ann-bid">${made ? 'Contrat rempli' : 'Chute !'}</span></div>`;

// ------------------------------------------------------------------ the rules
const cards = (ids: string, trump: Suit | null = null) => `<span class="rule-cards">${ids.split(' ').map(id => coincheCard(CO.card(id), trump, 'small')).join('')}</span>`;
const valuesRow = (ranks: number[], s: Suit, trump: boolean) => `<ol class="co-values-rule">${ranks.map(r => `<li>${coincheCard({ id: `${s}${r}`, r, s }, trump ? s : null, 'small')}<b>${points({ id: '', r, s }, trump ? s : 'X' as Suit)}</b></li>`).join('')}</ol>`;

export function coincheRulesHtml() {
  return rulesFrame('Coinche — les règles', `
    <section><h3>But</h3><p>À 4, en <b>deux équipes de deux</b> : ton partenaire est en face. Chaque donne, une équipe s'engage à faire un nombre de points (le <b>contrat</b>) avec la couleur d'atout de son choix ; l'autre défend. La première équipe à l'objectif (1 000, 1 500 ou 2 000, réglage de l'hôte) gagne la partie. Des robots complètent les places libres.</p>
      <p class="note">Au classement du salon, chaque donne rapporte à chacun les points de son équipe.</p></section>
    <section><h3>Les cartes (32) et leurs points</h3><p>À l'<b>atout</b>, de la plus forte à la plus faible :</p>${valuesRow([11, 9, 14, 10, 13, 12, 8, 7], 'H', true)}
      <p>Dans les <b>autres couleurs</b> :</p>${valuesRow([14, 10, 13, 12, 11, 9, 8, 7], 'S', false)}
      <p class="note">Le Valet et le 9 d'atout sont les plus forts. 152 points dans les cartes, plus 10 pour le <b>dernier pli</b> (« dix de der ») : 162. Faire les 8 plis (le capot) compte 250.</p></section>
    <section><h3>Les enchères</h3><p>Chacun à son tour, en commençant à gauche du donneur, <b>annonce</b> un contrat — de 80 à 160 points, par 10, avec une couleur d'atout — plus haut que le précédent, ou <b>passe</b>. Le <b>capot</b> (faire tous les plis) est l'annonce la plus haute et clôt les enchères. Trois passes après une annonce les terminent ; si les quatre passent d'entrée, on redonne.</p>
      <div class="rule-example"><span class="role-badge co-say">90 ${sign('S')}</span><span class="rule-arrow">puis</span><span class="role-badge co-say">100 ${sign('H')}</span><span class="rule-arrow">puis</span><span class="role-badge co-say pass">Passe</span><span class="role-badge co-say pass">Passe</span><span class="role-badge co-say pass">Passe</span><span class="rule-arrow">: contrat 100 à cœur</span></div>
      <p><b>Coincher</b> : un adversaire de la dernière annonce peut, à son tour, la coincher (« vous ne la ferez pas ») : elle compte double et les enchères s'arrêtent. Les preneurs peuvent alors <b>surcoincher</b> : quadruple. Le capot ne se coinche pas.</p></section>
    <section><h3>Jouer</h3><p>Le joueur à gauche du donneur entame ; qui remporte un pli entame le suivant. Il faut :</p><ol class="rule-roles">
      <li><span class="role-badge">Fournir</span><span>jouer la couleur demandée si on l'a (sans obligation de monter)</span><b></b></li>
      <li><span class="role-badge">Monter à l'atout</span><span>l'atout demandé, jouer plus fort si on peut</span><b></b></li>
      <li><span class="role-badge">Couper</span><span>sans la couleur, jouer atout…</span><b></b></li>
      <li><span class="role-badge">Surcouper / pisser</span><span>…plus fort qu'un atout adverse déjà posé, sinon un atout plus faible</span><b></b></li>
      <li><span class="role-badge">Partenaire maître</span><span>si ton partenaire gagne le pli, tu joues ce que tu veux</span><b></b></li></ol>
      <div class="rule-example">${cards('S14')}<span class="rule-arrow">sans pique, atout cœur :</span>${cards('H8', 'H')}<span class="rule-arrow">l'adversaire surcoupe</span>${cards('H11', 'H')}</div>
      <p class="note">Le pli va au plus fort atout, sinon à la plus forte carte de la couleur demandée.</p></section>
    <section><h3>Belote et rebelote</h3><p>Le <b>Roi et la Dame d'atout</b> dans une même main : 20 points pour son équipe, annoncés en les jouant (« Belote », puis « Rebelote »). Ils comptent pour remplir le contrat et restent acquis même s'il chute.</p>${cards('H13 H12', 'H')}</section>
    <section><h3>Le décompte</h3><p>Le contrat est <b>rempli</b> si les preneurs font au moins leur annonce (et au moins 82, plus de la moitié), belote comprise. Les points se comptent à la dizaine la plus proche.</p><ol class="rule-roles">
      <li><span class="role-badge role-president">Rempli</span><span>les preneurs marquent leurs points + l'annonce, la défense ses points</span><b></b></li>
      <li><span class="role-badge">Chuté</span><span>les preneurs ne marquent rien (sauf leur belote), la défense 160 + l'annonce</span><b></b></li>
      <li><span class="role-badge co-say coinche">Coinché</span><span>l'annonce compte double ; surcoinché, quadruple</span><b></b></li>
      <li><span class="role-badge">Capot</span><span>annoncé : 500 réussi, 500 pour la défense s'il chute</span><b></b></li></ol>
      <p class="note">Exemple : Léa prend 100 ${sign('H')} ; son équipe fait 92 points + la belote (112), la défense 70 → Léa et son partenaire +210 (90 + 100 + 20), la défense +70. Si Malo avait coinché un 120 ${sign('S')} chuté : son équipe +400 (160 + 2 × 120).</p></section>`);
}

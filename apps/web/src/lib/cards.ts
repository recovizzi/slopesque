// Card games (activity « Cartes »): the list of games, the SVG of a card, the table of a game (header with the clock
// and the rules, the other players around, the trick, my hand in a fan) and the rules window with SVG examples.
// Playable in the mockup: the Trou du cul (tdc.ts) and the Tarot (tarot.ts, tarot-view.ts, which reuses the helpers
// below); Texas Hold'em and Coinche are listed, to come.
// See openspec/changes/define-game-concept/specs/card-games/spec.md.
import { avatarHtml, esc } from './html';
import { icon } from './icons';
import { Tdc as T } from '@slopesque/engines';

const { canPlay, playName, rankLabel, rankName, ROLES, top } = T;
type Card = T.Card; type Role = T.Role; type Suit = T.Suit; type Tdc = T.Tdc;

export type CardGame = 'tdc' | 'tarot' | 'holdem' | 'coinche';
export const CARD_GAMES: Record<CardGame, { name: string; ready: boolean; help: string }> = {
  tdc: { name: 'Trou du cul', ready: true, help: 'Aussi appelé Président. Se débarrasser de ses cartes le premier : les rôles de la manche donnent des points et des échanges de cartes.' },
  tarot: { name: 'Tarot', ready: true, help: 'À 4 : le preneur contre les trois autres. Enchères (Prise, Garde, Garde sans, Garde contre), chien et écart, 21 atouts et l\'Excuse ; les points du preneur dépendent de ses bouts. Les atouts peuvent avoir leurs images (ci-dessous).' },
  holdem: { name: 'Texas Hold\'em', ready: false, help: 'À venir : le poker à deux cartes et cinq communes, des mises à chaque tour.' },
  coinche: { name: 'Coinche', ready: false, help: 'À venir : la belote contrée, 2 contre 2, enchères, coinche et surcoinche.' },
};

// ------------------------------------------------------------------ a card
export const SUIT_EMOJI: Record<Suit, string> = { S: '♠️', H: '♥️', D: '♦️', C: '♣️' };
const red = (s: Suit) => s === 'H' || s === 'D';

export const SUIT_NAME: Record<Suit, string> = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };

/** A card: a small rounded rectangle; at the top, the value on the left and the suit (emoji) on the right; the same
 *  at the bottom, turned upside down (readable either way); a big suit in the middle. viewBox 60 × 84. */
export const cardSvg = (c: Card, cls = '') => faceSvg(rankLabel(c.r), c.s, `${rankName(c.r)} de ${SUIT_NAME[c.s]}`, cls);

export function faceSvg(v: string, s: Suit, aria: string, cls = '') {
  const corner = `<text x="6" y="17" class="cv">${v}</text><text x="54" y="16" class="cs" text-anchor="end">${SUIT_EMOJI[s]}</text>`;
  const c = { s };
  return `<svg class="card-svg ${red(c.s) ? 'red' : 'black'} ${cls}" viewBox="0 0 60 84" role="img" aria-label="${esc(aria)}">
    <rect class="cbg" x=".75" y=".75" width="58.5" height="82.5" rx="7"/>
    <g class="corner-top">${corner}</g><g class="corner-bottom" transform="rotate(180 30 42)">${corner}</g>
    <text x="30" y="49" class="cc" text-anchor="middle">${SUIT_EMOJI[c.s]}</text></svg>`;
}

export const backSvg = (cls = '') => `<svg class="card-svg back ${cls}" viewBox="0 0 60 84" aria-hidden="true"><rect class="cbk" x=".75" y=".75" width="58.5" height="82.5" rx="7"/>
  <rect class="cbk-in" x="6" y="6" width="48" height="72" rx="4"/><path class="cbk-l" d="M6 6L54 78M54 6L6 78M30 6V78M6 42H54"/></svg>`;

// ------------------------------------------------------------------ the table
export interface TableCtx {
  t: Tdc;
  me: string;
  playing: boolean;                 // I have a seat (not a spectator)
  host: boolean;
  selected: Set<string>;
  fan: { r: number; step: number };   // my hand's fan (app.ts measures the width): angles set at once, nothing moves
  who: (id: string) => { name: string; color: string; bot?: boolean; photo?: string | null };
  elapsed: string;
  late?: { seat: string; secs: number; vote: boolean } | null;   // a player's turn has lasted 30 s: a vote to make him leave
  seats?: {                         // Trou du cul: the table's seats, to join or leave it
    free: number; total: number;    // seats a robot plays, of all
    mine: boolean;                  // a robot still plays my seat (I left during this round)
    takes: string;                  // the robot whose seat I'd take
    full: boolean;                  // I tried to join a full table (the error, on the button)
    paid: (id: string) => { name: string; color: string; bot: boolean };   // who got a seat's points at the end
  };
}

/** A seat's name; a robot plays it: the robot icon (for a player who left: until the end of the round). */
export const seatLabel = (p: { name: string; bot?: boolean }, cls = 'seat-name') => `<span class="${cls}">${esc(p.name)}</span>${p.bot
  ? `<span class="seat-bot" title="Un robot joue cette place">${icon.bot}</span>` : ''}`;

export const handAngle = (i: number, n: number, step: number) => ((i - (n - 1) / 2) * step).toFixed(4);
export const head = (title: string, info: string) => `<header class="cg-head"><b class="cg-title">${esc(title)}</b><span class="cg-info">${info}</span><span class="spacer"></span>
  <span class="cg-clock" data-card-clock title="Temps de jeu"></span>
  <button class="icon-btn sm cg-rules" type="button" data-action="cards-rules" title="Règles du jeu" aria-label="Règles du jeu">${icon.info}</button></header>`;
export const rulesFrame = (title: string, body: string) => `<div class="modal-backdrop" data-action="rules-close"></div>
  <div class="modal rules" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="rules-head"><h2>${esc(title)}</h2><button class="icon-btn sm" type="button" data-action="rules-close" title="Fermer" aria-label="Fermer">${icon.close}</button></div>${body}</div>`;

const roleBadge = (r: Role | undefined) => (r ? `<span class="role-badge role-${r}">${ROLES[r].name}</span>` : '');
/** A play on the table, slightly turned (always the same way for the same cards). */
const tilt = (cs: Card[]) => ((cs[0].r * 7 + cs.length * 13) % 17) - 8;

export function tableHtml(c: TableCtx) {
  const { t, me } = c;
  const over = t.turn === null, last = top(t), mine = t.hands[me] ?? [];
  const info = over ? `Manche ${t.round} terminée` : `Manche ${t.round} · ${t.turn === me ? '<b>à toi de jouer</b>' : `à ${esc(c.who(t.turn!).name)} de jouer`}`;
  const seats = t.seats.filter(id => id !== me).map(id => {
    const p = c.who(id), n = t.hands[id].length, place = t.out.indexOf(id);
    const late = c.late?.seat === id ? c.late : null;
    return `<li class="cg-seat ${t.turn === id ? 'is-turn' : ''} ${late ? 'is-late' : ''} ${t.passed.includes(id) ? 'has-passed' : ''} ${place >= 0 ? 'is-out' : ''}" data-seat="${esc(id)}" style="--c:${p.color}">
      ${avatarHtml(p.name, p.color, p.bot ? null : p.photo)}${seatLabel(p)}${roleBadge(t.roles[id])}
      <span class="seat-cards" title="${n} cartes">${backSvg('mini')}<b>${n}</b></span>
      ${place >= 0 ? `<span class="seat-state">sorti ${place + 1}${place ? 'e' : 'er'}</span>` : t.passed.includes(id) ? '<span class="seat-state">passe</span>' : ''}
      ${late ? (late.vote ? '<span class="seat-state">vote en cours</span>' : `<button class="seat-kick" type="button" data-action="kick" title="Son tour dure depuis ${late.secs} s : proposer au vote qu'un robot joue à sa place (comme /kick)">${icon.kick}Exclure ?</button>`) : ''}</li>`;
  }).join('');
  const closed = !t.trick.length && t.lastTrick.length > 0;   // the trick just taken stays shown, dimmed
  const plays = (closed ? t.lastTrick : t.trick).slice(-3).map((p, k, arr) => `<div class="play ${k === arr.length - 1 ? 'is-last' : ''} ${closed ? 'is-closed' : ''}" style="--t:${tilt(p.cards)}deg">
      ${p.cards.map(cd => `<span class="pcard on-table" data-card="${cd.id}">${cardSvg(cd)}</span>`).join('')}</div>`).join('');
  const taker = closed ? t.lastTrick[t.lastTrick.length - 1].by : null;
  const pileText = over ? '' : last ? `${esc(c.who(last.by).name)} : ${playName(last.cards)} — à battre avec autant de cartes plus fortes`
    : taker ? `${esc(c.who(taker).name)} ramasse le pli${t.turn === me ? ' : à toi d\'ouvrir' : ''}` : 'Pli vide : ouvre avec 1 à 4 cartes de même valeur';
  const results = over ? `<div class="cg-results"><h3>Manche ${t.round}</h3><ol>${t.out.map(id => {
    const r = t.roles[id], p = c.seats?.paid(id) ?? { ...c.who(id), bot: false };
    return `<li class="${p.bot ? 'is-bot' : ''}" style="--c:${p.color}"><span class="dot" style="--c:${p.color}"></span>${seatLabel(p, 'res-name')}${roleBadge(r)}<span class="pts" ${p.bot ? 'title="Un robot : pas de points"' : ''}>${p.bot ? '—' : `+${ROLES[r].points}`}</span></li>`;
  }).join('')}</ol>${c.host ? '<button class="btn" type="button" data-action="cards-deal">Nouvelle manche</button>' : '<p class="note">L\'hôte lance la manche suivante.</p>'}</div>` : '';
  const sel = mine.filter(cd => c.selected.has(cd.id)), myTurn = !over && t.turn === me;
  const angle = (i: number) => ((i - (mine.length - 1) / 2) * c.fan.step).toFixed(4);
  const hand = c.playing ? `<div class="cg-hand" data-hand style="--n:${mine.length};--r:${c.fan.r}px">${mine.map((cd, i) => `<button type="button" class="pcard in-hand ${c.selected.has(cd.id) ? 'is-selected' : ''}"
      data-action="card-pick" data-card="${cd.id}" style="--a:${angle(i)}rad" aria-pressed="${c.selected.has(cd.id)}">${cardSvg(cd)}</button>`).join('')}</div>
    <div class="cg-actions">${c.seats ? '<button class="btn ghost sm cg-leave" type="button" data-action="table-leave" title="Un robot joue ta main à ta place">Quitter la table</button>' : ''}${roleBadge(t.roles[me])}<span class="cg-hint">${over ? '' : myTurn ? (sel.length ? (canPlay(t, sel) ? `Jouer ${playName(sel)} ?` : 'Pas jouable : autant de cartes que le pli, plus fortes') : 'Choisis tes cartes (même valeur)') : 'Attends ton tour…'}</span>
      <button class="btn ghost" type="button" data-action="cards-pass" ${myTurn && last ? '' : 'disabled'}>Passer</button>
      <button class="btn" type="button" data-action="cards-play" ${myTurn && canPlay(t, sel) ? '' : 'disabled'}>Jouer${sel.length ? ` (${sel.length})` : ''}</button></div>`
    : c.seats ? joinHtml(c.seats, over) : '<p class="note cg-watch">Tu regardes la partie : clique « Participer » pour jouer à la manche suivante.</p>';
  return `<div class="cards-game ${myTurn ? 'my-turn' : ''}">
    <header class="cg-head"><b class="cg-title">Trou du cul</b><span class="cg-info">${info}</span><span class="spacer"></span>
      <span class="cg-clock" data-card-clock title="Temps de jeu">${c.elapsed}</span>
      <button class="icon-btn sm cg-rules" type="button" data-action="cards-rules" title="Règles du jeu" aria-label="Règles du jeu">${icon.info}</button></header>
    <div class="cg-table"><ul class="cg-seats">${seats}</ul>
      <div class="cg-pile" data-pile>${plays}${results}</div><p class="cg-pile-text">${pileText}</p></div>
    <div class="cg-me">${hand}</div></div>`;
}

/** Watching: join the table, at a seat a robot plays (my own first); a full table: the error on the button. */
function joinHtml(s: NonNullable<TableCtx['seats']>, over: boolean) {
  const label = s.full ? `Table complète (${s.total}/${s.total})` : s.mine ? 'Reprendre ma place' : s.free ? `Prendre la place de ${s.takes}` : 'Rejoindre la partie';
  const why = s.mine ? 'Un robot joue ta main depuis que tu as quitté la table : reprends-la, les points de la manche restent les tiens.'
    : s.free ? `${s.free} place${s.free > 1 ? 's' : ''} sur ${s.total} ${s.free > 1 ? 'sont jouées' : 'est jouée'} par un robot : prends-en une, tu joues sa main ${over ? 'à la prochaine manche' : 'tout de suite'} et ses points deviennent les tiens.`
    : `Les ${s.total} places sont prises par des joueurs.`;
  return `<div class="cg-watch"><p class="note">Tu regardes la partie. ${esc(why)}</p>
    <button class="btn cg-join ${s.full ? 'is-error' : ''}" type="button" data-action="table-join" ${s.full ? 'aria-invalid="true"' : ''}>${icon.users}${esc(label)}</button></div>`;
}

// ------------------------------------------------------------------ the rules
const C = (r: number, s: Suit): Card => ({ id: `${r}${s}`, r, s });
const row = (cs: Card[]) => `<span class="rule-cards">${cs.map(cd => cardSvg(cd, 'small')).join('')}</span>`;

/** The rules of the Trou du cul, with examples drawn with the same cards. */
export function rulesHtml() {
  return `<div class="modal-backdrop" data-action="rules-close"></div>
  <div class="modal rules" role="dialog" aria-modal="true" aria-label="Règles du Trou du cul">
    <div class="rules-head"><h2>Trou du cul — les règles</h2><button class="icon-btn sm" type="button" data-action="rules-close" title="Fermer" aria-label="Fermer">${icon.close}</button></div>
    <section><h3>But</h3><p>Se débarrasser de toutes ses cartes <b>le premier</b>. L'ordre de sortie donne les rôles de la manche, et des points au classement du salon.</p></section>
    <section><h3>Valeur des cartes</h3><p>De la plus faible à la plus forte (la couleur ne compte pas) :</p>
      ${row([C(3, 'C'), C(4, 'D'), C(5, 'H'), C(6, 'S'), C(7, 'C'), C(8, 'D'), C(9, 'H'), C(10, 'S'), C(11, 'C'), C(12, 'D'), C(13, 'H'), C(14, 'S'), C(15, 'C')])}
      <p class="note">Le <b>2</b> est la plus forte : personne ne peut le battre, il ferme le pli.</p></section>
    <section><h3>Jouer</h3><p>Celui qui ouvre pose 1 carte, une paire, un brelan ou un carré <b>de même valeur</b>. Chacun à son tour pose <b>autant de cartes, plus fortes</b>, ou passe.</p>
      <div class="rule-example">${row([C(7, 'H'), C(7, 'S')])}<span class="rule-arrow ok">battue par</span>${row([C(9, 'C'), C(9, 'D')])}</div>
      <div class="rule-example">${row([C(7, 'H'), C(7, 'S')])}<span class="rule-arrow ko">pas par</span>${row([C(13, 'C')])}<span class="rule-arrow ko">ni par</span>${row([C(5, 'C'), C(5, 'D')])}</div></section>
    <section><h3>Fin du pli</h3><p>Quand tous les autres ont passé, le dernier à avoir posé ramasse le pli et rejoue ce qu'il veut. Qui a passé ne rejoue pas dans ce pli.</p></section>
    <section><h3>Rôles et points</h3><ol class="rule-roles">${(Object.keys(ROLES) as Role[]).map(r => `<li>${roleBadge(r)}<span>${{ president: '1er sorti', vice: '2e sorti', neutre: 'au milieu', vtdc: 'avant-dernier', tdc: 'dernier' }[r]}</span><b>+${ROLES[r].points}</b></li>`).join('')}</ol>
      <p class="note">À 3 joueurs : Président, Neutre, Trou du cul.</p></section>
    <section><h3>Échanges à la manche suivante</h3>
      <div class="rule-example">${roleBadge('tdc')}<span class="rule-arrow">donne ses 2 meilleures</span>${row([C(15, 'S'), C(14, 'H')])}<span class="rule-arrow">au</span>${roleBadge('president')}</div>
      <div class="rule-example">${roleBadge('president')}<span class="rule-arrow">lui rend 2 cartes</span>${row([C(3, 'D'), C(4, 'C')])}</div>
      <p>Le Vice-trou du cul et le Vice-président échangent de même <b>1 carte</b>. Puis le <b>Trou du cul commence</b>.</p></section>
  </div>`;
}

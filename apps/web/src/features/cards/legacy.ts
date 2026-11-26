// LEGACY (removed with task 3.3 of openspec refactor-architecture): the card table's pieces as HTML strings, for the
// Texas Hold'em and Coinche views not converted to React yet (holdem/holdem-view.ts, holdem/holdem-anim.ts,
// coinche/coinche-view.ts). The same markup as the React pieces of this folder (PlayingCard, CardBack, SeatPill,
// SeatLabel, KickButton, TableHead, design's Modal): once those views are components, delete this file.
import { avatarHtml, esc } from '../../legacy/html';
import { icon } from '../../legacy/icons';
import { isRed, SUIT_EMOJI, type Suit } from './model';

export { handAngle, seatCols } from './model';

/** @deprecated <PlayingCard value suit label className> (PlayingCard.tsx). */
export function faceSvg(v: string, s: Suit, aria: string, cls = '') {
  const corner = `<text x="6" y="17" class="cv">${v}</text><text x="54" y="16" class="cs" text-anchor="end">${SUIT_EMOJI[s]}</text>`;
  return `<svg class="card-svg ${isRed(s) ? 'red' : 'black'} ${cls}" viewBox="0 0 60 84" role="img" aria-label="${esc(aria)}">
    <rect class="cbg" x=".75" y=".75" width="58.5" height="82.5" rx="7"/>
    <g class="corner-top">${corner}</g><g class="corner-bottom" transform="rotate(180 30 42)">${corner}</g>
    <text x="30" y="49" class="cc" text-anchor="middle">${SUIT_EMOJI[s]}</text></svg>`;
}

/** @deprecated <CardBack className> (PlayingCard.tsx). */
export const backSvg = (cls = '') => `<svg class="card-svg back ${cls}" viewBox="0 0 60 84" aria-hidden="true"><rect class="cbk" x=".75" y=".75" width="58.5" height="82.5" rx="7"/>
  <rect class="cbk-in" x="6" y="6" width="48" height="72" rx="4"/><path class="cbk-l" d="M6 6L54 78M54 6L6 78M30 6V78M6 42H54"/></svg>`;

/** @deprecated <SeatLabel p className> (SeatPill.tsx). */
export const seatLabel = (p: { name: string; bot?: boolean }, cls = 'seat-name') => `<span class="${cls}">${esc(p.name)}</span>${p.bot
  ? `<span class="seat-bot" title="Un robot joue cette place">${icon.bot}</span>` : ''}`;

/** @deprecated <SeatPill p sub side mark extra> (SeatPill.tsx). */
export function seatPill(p: { name: string; color: string; bot?: boolean; photo?: string | null }, o: { tag?: 'li' | 'div'; cls?: string; attrs?: string; sub?: string; side?: string; mark?: string; extra?: string } = {}) {
  const tag = o.tag ?? 'li';
  return `<${tag} class="cg-seat ${o.cls ?? ''}" ${o.attrs ?? ''} style="--c:${p.color}">${o.mark ?? ''}${p.bot ? `<span class="seat-bot corner" title="Un robot joue cette place">${icon.bot}</span>` : ''}
    ${avatarHtml(p.name, p.color, p.bot ? null : p.photo)}<span class="seat-main"><span class="seat-name" title="${esc(p.name)}">${esc(p.name)}</span>${o.sub ? `<span class="seat-sub">${o.sub}</span>` : ''}</span>${o.side ? `<span class="seat-side">${o.side}</span>` : ''}${o.extra ?? ''}</${tag}>`;
}

/** @deprecated <KickButton late onKick> (SeatPill.tsx). */
export const kickBtn = (late: { secs: number; vote: boolean } | null) => (!late ? '' : late.vote ? '<span class="seat-kick is-vote">vote en cours</span>'
  : `<button class="seat-kick" type="button" data-action="kick" title="Son tour dure depuis ${late.secs} s : proposer au vote qu'un robot joue à sa place (comme /kick)">${icon.kick}Exclure ?</button>`);

/** @deprecated <TableHead title info start onRules> (TableHead.tsx); the clock is filled by CardsStage's LegacyTable. */
export const head = (title: string, info: string) => `<header class="cg-head"><b class="cg-title">${esc(title)}</b><span class="cg-info">${info}</span><span class="spacer"></span>
  <span class="cg-clock" data-card-clock title="Temps de jeu"></span>
  <button class="icon-btn sm cg-rules" type="button" data-action="cards-rules" title="Règles du jeu" aria-label="Règles du jeu">${icon.info}</button></header>`;

/** @deprecated design's <Modal title className="rules" closeButton onClose> (see tdc/TdcRules.tsx). */
export const rulesFrame = (title: string, body: string) => `<div class="modal-backdrop" data-action="rules-close"></div>
  <div class="modal rules" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="rules-head"><h2>${esc(title)}</h2><button class="icon-btn sm" type="button" data-action="rules-close" title="Fermer" aria-label="Fermer">${icon.close}</button></div>${body}</div>`;

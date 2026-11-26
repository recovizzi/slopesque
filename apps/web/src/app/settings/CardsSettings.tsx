// Partie, cards: moved here from App.tsx unchanged (the cards' own rewrite, task 3.2/3.3, takes it over).
import { CARD_PLAYERS, COINCHE_TARGETS, HOLDEM_EVERY, HOLDEM_STACKS, cardGameOf } from '@slopesque/shared';
import { request } from '../net';
import { useStore } from '../store';
import { Button, Checkbox, Field, Note, Select } from '../../design';
import { TrumpArt } from '../../features/cards/tarot/TrumpArt';
import { GAME_HELP } from './texts';

const BOT_LEVELS = {
  coinche: ['Facile — des fautes, des enchères au hasard', 'Moyen — compte les cartes, charge son partenaire', 'Fort — simule la fin de la donne'],
  holdem: ['Facile — suit trop, se trompe, bluffe peu', 'Moyen — ses chances contre la cote du pot', 'Fort — devine les mains d\'après les mises, bluffe mieux'],
  other: ['Facile — des fautes, des enchères prudentes', 'Moyen — les règles du jeu, un peu de hasard', 'Fort — il calcule la fin de la donne'],
};

/** Partie (cards): the game first, then its number of players (the values each game allows; robots complete the
 *  free seats, from the next deal), and the Tarot's won tricks shown or not. */
export function CardsSettings() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)?.id, set = useStore(s => s.set), host = room.hostId === me;
  const game = cardGameOf(room.activity), players = room.cards.settings[game] ?? CARD_PLAYERS[game][0];
  const hr = room.cards.settings.holdemRules ?? { stack: 1000, every: 10 }, holdemOn = room.cards.game === 'holdem' && !!room.cards.holdem && !room.cards.holdem.over;
  const ack = (r: { ok: boolean; error?: string }) => { if (!r.ok) set({ note: r.error ?? '' }); };
  const deal = room.cards.settings.dealMode ?? 'random';
  const dealMode = <><Field label="Distribution"><Select value={deal} disabled={!host} onChange={async v => ack(await request('cards:deal-mode', { mode: v as 'random' }))}
      options={[{ value: 'random', label: 'Aléatoire — le paquet mélangé à chaque donne' }, { value: 'classic', label: 'À l\'ancienne — plis ramassés, coupe, distribution par paquets' }]} /></Field>
    <Note>{deal === 'classic' ? 'Comme à table : les couleurs restent groupées, plus de mains déséquilibrées (longues couleurs, coupes franches). La première donne d\'une partie est mélangée.' : 'Le hasard pur : des mains souvent équilibrées. « À l\'ancienne » en donne de plus déséquilibrées.'} À partir de la donne suivante.</Note></>;
  const levels = BOT_LEVELS[game === 'coinche' || game === 'holdem' ? game : 'other'];
  const bots = <><Field label="Niveau des robots"><Select value={room.cards.settings.bots ?? 'moyen'} disabled={!host} onChange={async v => ack(await request('cards:bots', { level: v as 'moyen' }))}
      options={(['facile', 'moyen', 'fort'] as const).map((v, i) => ({ value: v, label: levels[i] }))} /></Field>
    <Note>Les robots jouent comme un joueur : avec ce que leur place voit, jamais les cartes des autres. Le niveau vaut pour tous les jeux de cartes.</Note></>;
  return <>
    <Field label="Jeu"><Select value={game} disabled={!host} onChange={async v => ack(await request('activity:choose', { choice: { activity: 'cards', cardGame: v as 'tdc' } }))}
      options={[{ value: 'tdc', label: 'Trou du cul' }, { value: 'tarot', label: 'Tarot' }, { value: 'holdem', label: 'Texas Hold\'em' }, { value: 'coinche', label: 'Coinche' }]} /></Field>
    <Note>{GAME_HELP[game]}</Note>
    <Field label="Joueurs"><Select value={players} disabled={!host} onChange={async v => ack(await request('cards:players', { game, players: Number(v) }))}
      options={CARD_PLAYERS[game].map(n => ({ value: n, label: `${n} joueurs${game === 'tarot' && n === 5 ? ' (le preneur appelle un Roi)' : game === 'holdem' && n === 2 ? ' (en tête-à-tête)' : game === 'coinche' ? ' (deux contre deux)' : ''}` }))} /></Field>
    <Note>À partir de la {game === 'holdem' ? 'partie' : 'donne'} suivante. Prends une place à la table avant la donne ; des robots complètent les places libres. Les règles se lisent avec le bouton « i » de la table.</Note>
    {game === 'tarot' && <><Checkbox label="Revoir les plis gagnés (au survol)" checked={room.cards.showTricks} disabled={!host} onChange={show => void request('tarot:tricks', { show })} />
      <Note>Décoché, la partie est plus dure : personne ne peut revoir les plis déjà joués.</Note>
      {dealMode}{bots}
      <TrumpArt edit={host} /></>}
    {game === 'coinche' && <>
      <Field label="Objectif"><Select value={room.cards.settings.coincheTarget ?? 1000} disabled={!host} onChange={async v => ack(await request('coinche:target', { target: Number(v) }))}
        options={COINCHE_TARGETS.map(n => ({ value: n, label: `${n} points${n === 1000 ? ' (une partie courte)' : ''}` }))} /></Field>
      <Note>La première équipe à ce score gagne, après la donne qui l'y amène. À partir de la partie suivante.</Note>
      {dealMode}{bots}</>}
    {game === 'holdem' && <>
      <Field label="Tapis de départ"><Select value={hr.stack} disabled={!host} onChange={async v => ack(await request('holdem:rules', { stack: Number(v) }))}
        options={HOLDEM_STACKS.map(n => ({ value: n, label: `${n} jetons (${n / 20} grosses blindes)` }))} /></Field>
      <Field label="Montée des blindes"><Select value={hr.every} disabled={!host} onChange={async v => ack(await request('holdem:rules', { every: Number(v) }))}
        options={HOLDEM_EVERY.map(n => ({ value: n, label: n ? `Toutes les ${n} mains` : 'Jamais (blindes fixes 10 / 20)' }))} /></Field>
      <Note>Blindes de départ 10 / 20, puis 20 / 40, 30 / 60, 40 / 80… Plus le tapis est petit et les blindes montent vite, plus la partie est courte. À partir de la partie suivante.</Note>
      {bots}
      {host && holdemOn && <><Button variant="danger" onClick={async () => { if (confirm('Terminer la partie ? Les joueurs encore en jeu sont classés selon leurs jetons.')) ack(await request('holdem:end')); }}>Terminer la partie</Button>
        <Note>Les joueurs encore en jeu sont classés selon leurs jetons ; chacun reçoit les points de sa place.</Note></>}</>}
  </>;
}

// Partie, for the players who aren't the host: each setting on its line — what it is (and does) on the left, the
// host's choice on the right — read only; a long choice goes on its own line.
import type { ReactNode } from 'react';
import { cardGameOf, type RoomState } from '@slopesque/shared';
import { useStore } from '../store';
import { ACT_HELP, ACT_NAMES, GAME_HELP, GAME_NAMES, LEVEL_NAMES } from './texts';
import { Avatar, Note } from '../../design';
import { TrumpArt } from '../../features/cards/tarot/TrumpArt';

type Row = [label: string, help: string, value: ReactNode];

const fmtDur = (s: number) => (s < 3600 ? `${s / 60} min` : `${s / 3600} h`);
const fmtEvery = (n: number) => (n ? `Toutes les ${n} mains` : 'Jamais');

function diskRows(room: RoomState): Row[] {
  const d = { ...room.disk.rules, ...room.disk.pending },
    amphi = d.mode === 'amphi';
  return [
    ['Sujet', 'La question posée à chaque tour', d.topic],
    [
      'Extrémités',
      'Les deux bouts du demi-disque',
      <>
        {d.left} <span className="ro-arrow">↔</span> {d.right}
      </>,
    ],
    [
      'Mode de scrutin',
      amphi ? "Une colonne pour l'hôte, un siège par candidat" : 'Chacun place son rayon où il veut',
      amphi ? 'Amphithéâtre' : 'Rayon libre',
    ],
    ['Temps de réponse', 'Pour placer sa réponse', `${d.roundSeconds} s`],
  ];
}

function cardsRows(room: RoomState): Row[] {
  const s = room.cards.settings,
    game = cardGameOf(room.activity),
    hr = s.holdemRules ?? { stack: 1000, every: 10 };
  const bots: Row = ['Niveau des robots', 'Ils jouent avec ce que leur place voit', LEVEL_NAMES[s.bots ?? 'moyen']];
  const deal: Row = [
    'Distribution',
    "À l'ancienne : plis ramassés, coupe, par paquets (plus de mains déséquilibrées)",
    (s.dealMode ?? 'random') === 'classic' ? "À l'ancienne" : 'Aléatoire',
  ];
  const rows: Row[] = [
    ['Jeu', GAME_HELP[game], GAME_NAMES[game]],
    [
      'Joueurs',
      'Des robots complètent les places libres',
      `${s[game]}${game === 'tarot' && s.tarot === 5 ? ' · Roi appelé' : ''}`,
    ],
  ];
  if (game === 'tarot')
    rows.push(
      ['Revoir les plis gagnés', "Au survol d'un joueur ou de sa pile", room.cards.showTricks ? 'Oui' : 'Non'],
      bots,
    );
  if (game === 'holdem')
    rows.push(
      ['Tapis de départ', `Les mêmes jetons pour tous ; blindes de départ 10 / 20`, `${hr.stack} jetons`],
      ['Montée des blindes', '20 / 40, 30 / 60, 40 / 80… : la partie finit plus vite', fmtEvery(hr.every)],
      bots,
    );
  if (game === 'coinche' || game === 'tarot') rows.push(deal);
  if (game === 'coinche')
    rows.push(['Objectif', 'La première équipe à ce score gagne la partie', `${s.coincheTarget ?? 1000} points`], bots);
  return rows;
}

/** The lines of the activity's settings. */
function rowsOf(room: RoomState): Row[] {
  const act = room.activity.activity;
  if (act === 'disk') return diskRows(room);
  if (act === 'poll')
    return [
      [
        'Temps de réponse',
        'Le sondage se ferme à la fin du temps, ou quand tous ont répondu',
        fmtDur(room.poll.seconds),
      ],
      [
        'Résultats',
        room.poll.secret ? 'Personne ne voit qui a répondu quoi' : "Survoler un résultat montre qui l'a donné",
        room.poll.secret ? 'Secrets' : 'Nominatifs',
      ],
    ];
  if (act === 'wheel')
    return [
      [
        'Propositions',
        "Écrites par l'hôte dans la zone de jeu",
        String(room.wheel.items.filter(i => i.label.trim()).length),
      ],
      ['Tirage', 'Le numéro du tirage en cours', `n° ${room.wheel.round}`],
    ];
  if (act === 'cards') return cardsRows(room);
  if (act === 'lowtide')
    return [
      [
        'Adresse',
        "La page du jeu, vérifiée par l'hôte",
        <span className="ro-url">{Object.values(room.web)[0] ?? '—'}</span>,
      ],
    ];
  return [];
}

export function GameInfo() {
  const room = useStore(s => s.room)!,
    act = room.activity.activity,
    host = room.members.find(m => m.id === room.hostId);
  const rows: Row[] = [['Activité', ACT_HELP[act]!, ACT_NAMES[act]!], ...rowsOf(room)];
  return (
    <>
      <div className="ro-head">
        <span className="ro-who">Réglé par l'hôte</span>
        {host && (
          <span className="ro-host">
            <Avatar name={host.name} hue={host.hue} photo={host.photo} size="sm" />
            {host.name}
          </span>
        )}
      </div>
      <ul className="ro-settings">
        {rows.map(([label, help, value]) => (
          <li key={label} className={typeof value !== 'string' || value.length > 16 ? 'is-long' : ''}>
            <span className="ro-label">{label}</span>
            <span className="ro-value">{value}</span>
            <small className="ro-help">{help}</small>
          </li>
        ))}
      </ul>
      {act === 'cards' && cardGameOf(room.activity) === 'tarot' && <TrumpArt edit={false} />}
      <Note>Seul l'hôte modifie la partie ; propose une autre activité au vote avec /activity.</Note>
    </>
  );
}

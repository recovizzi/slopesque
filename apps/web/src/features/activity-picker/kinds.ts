// The kinds of activity of the /activity window (openspec: chat-activity), and their exact formats where there are
// several. An activity the V1 can't play yet (not in READY_ACTIVITIES) is shown greyed, « bientôt ».
import { READY_ACTIVITIES, type ActivityChoice } from '@slopesque/shared';
import type { ArtKind } from './ActivityArt';

export interface Format {
  label: string;
  help: string;
  choice: ActivityChoice;
  soon?: boolean;
}
export interface Kind {
  id: ArtKind;
  name: string;
  help: string;
  choice?: ActivityChoice;
  formats?: Format[];
}

export const KINDS: Kind[] = [
  {
    id: 'disk',
    name: 'Demi-disque',
    help: 'Placer un mot entre deux extrémités',
    formats: [
      { label: 'Rayon libre', help: 'Chacun place son rayon où il veut', choice: { activity: 'disk', mode: 'ray' } },
      {
        label: 'Amphithéâtre',
        help: "Un siège par candidat, l'hôte choisit une colonne",
        choice: { activity: 'disk', mode: 'amphi' },
      },
    ],
  },
  { id: 'poll', name: 'Sondage', help: 'Une question, les réponses de tous', choice: { activity: 'poll' } },
  { id: 'wheel', name: 'Roulette', help: 'Tirer au sort parmi des propositions', choice: { activity: 'wheel' } },
  { id: 'chat', name: 'Chat', help: 'Discuter, sans jeu', choice: { activity: 'chat' } },
  {
    id: 'cards',
    name: 'Cartes',
    help: 'Des jeux de cartes à plusieurs',
    formats: [
      {
        label: 'Trou du cul',
        help: 'Se débarrasser de ses cartes le premier · de 3 à 8 joueurs',
        choice: { activity: 'cards', cardGame: 'tdc' },
      },
      {
        label: 'Tarot',
        help: 'Le preneur contre les autres · à 4, ou à 5 avec un Roi appelé',
        choice: { activity: 'cards', cardGame: 'tarot' },
      },
      {
        label: "Texas Hold'em",
        help: 'Le poker en tournoi, jetons fictifs · de 2 à 8 joueurs',
        choice: { activity: 'cards', cardGame: 'holdem' },
      },
      {
        label: 'Coinche',
        help: 'La belote coinchée, deux contre deux · 4 joueurs',
        choice: { activity: 'cards', cardGame: 'coinche' },
      },
    ],
  },
  {
    id: 'web',
    name: 'Jeux web',
    help: "Le jeu d'un autre site, dans le salon",
    formats: [{ label: 'Low Tide', help: 'Course de bateaux, sur sa propre page', choice: { activity: 'lowtide' } }],
  },
];

export const ready = (c: ActivityChoice) => READY_ACTIVITIES.includes(c.activity);
/** The kind an activity belongs to (Low Tide: the web games). */
export const kindOf = (activity: string) => (activity === 'lowtide' ? 'web' : activity);
/** A kind none of whose formats can be played yet. */
export const kindOff = (k: Kind) => (k.choice ? !ready(k.choice) : !k.formats!.some(f => ready(f.choice)));

/** What a choice does: at once (the host), a vote in the chat (the others), or nothing while a vote runs. */
export function howText(host: boolean, busy: boolean) {
  if (host) return "Tu es l'hôte : l'activité change tout de suite.";
  if (busy) return 'Un vote est déjà en cours dans le chat : attends sa fin.';
  return "Ton choix sera proposé au vote dans le chat : 2 minutes, la majorité l'emporte, et la moitié des joueurs connectés doit voter.";
}

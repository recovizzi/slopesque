// What the Partie tab says of each activity and card game: its name, what it is, its robots' levels.

export const ACT_NAMES: Record<string, string> = {
  chat: 'Chat',
  disk: 'Demi-disque',
  poll: 'Sondage',
  wheel: 'Roulette',
  cards: 'Cartes',
  lowtide: 'Low Tide',
};

export const ACT_HELP: Record<string, string> = {
  disk: "Un mot par tour, placé entre deux extrémités ; des points selon la distance à la réponse de l'hôte.",
  poll: 'Une question, posée dans la zone de jeu : choix définis, choix libre ou gradient. Pas de points.',
  wheel:
    "Une roue de propositions, chacune avec un poids, construite dans la zone de jeu sous les yeux de tous ; l'hôte la lance, l'aiguille désigne le résultat. Pas de points.",
  chat: 'Pas de jeu : le chat en plein écran, la liste des joueurs à gauche. Les scores sont gardés.',
  cards:
    "Des jeux de cartes à plusieurs : le Trou du cul, le Tarot, le Texas Hold'em et la Coinche. Les manches donnent des points au classement.",
  lowtide: 'Le jeu Low Tide, sur sa propre page, dans la zone de jeu. Pas de points.',
};

/** The heading of the host's settings, by activity. */
export const SETTINGS_TITLES: Record<string, string> = {
  disk: 'Paramètres du demi-disque',
  poll: 'Paramètres du sondage',
  wheel: 'Paramètres de la roulette',
  chat: 'Paramètres du chat',
  lowtide: 'Paramètres de Low Tide',
  cards: 'Paramètres des cartes',
};

export const GAME_HELP = {
  tdc: 'Aussi appelé Président. Se débarrasser de ses cartes le premier : les rôles de la manche donnent des points et des échanges de cartes.',
  tarot:
    "À 4 : le preneur contre les trois autres ; à 5, il appelle un Roi. Enchères (Prise, Garde, Garde sans, Garde contre), chien et écart, 21 atouts et l'Excuse ; les points du preneur dépendent de ses bouts.",
  coinche:
    "La belote coinchée, deux contre deux : enchères de 80 à 160 (ou le capot) avec une couleur d'atout, coinche et surcoinche ; Valet et 9 d'atout les plus forts, belote-rebelote ; partie en 1 000 points ou plus.",
  holdem:
    'Le poker No Limit en tournoi, avec des jetons fictifs : deux cartes cachées, cinq communes, des mises à chaque tour ; le dernier à garder des jetons gagne. Points selon la place.',
};
export const GAME_NAMES = { tdc: 'Trou du cul', tarot: 'Tarot', holdem: "Texas Hold'em", coinche: 'Coinche' };
export const LEVEL_NAMES = { facile: 'Facile', moyen: 'Moyen', fort: 'Fort' } as const;

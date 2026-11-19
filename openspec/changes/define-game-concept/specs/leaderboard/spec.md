## ADDED Requirements

### Requirement: Onglet Palmarès
Le tiroir de gauche MUST avoir, en plus du Chat et du Classement (ou des Joueurs), un onglet « Palmarès » : la liste de
tous ceux qui ont déjà joué dans le salon, y compris ceux qui l'ont quitté (marqués « parti »), avec leurs parties
jouées, gagnées et leur taux de victoire, pour se comparer dans le temps. L'onglet actif MUST montrer son nom, les
autres leur icône (leur nom au survol), pour tenir dans le tiroir.

#### Scenario: Un joueur parti
- **WHEN** Zoé a joué il y a un mois puis a quitté le salon
- **THEN** elle est toujours dans le palmarès, marquée « parti »

### Requirement: Conservation du palmarès
Chaque résultat (un tour, une manche, une donne : le joueur, le jeu, gagné ou non, la date, ses mesures) MUST être
gardé à part des scores du classement : « Réinitialiser la partie » et la purge des données de jeu MUST ne pas
l'effacer. Le nom et la couleur du joueur au moment du résultat MUST être gardés (le palmarès montre les plus
récents). Les robots MUST ne pas y figurer.

#### Scenario: Après une réinitialisation
- **WHEN** l'hôte réinitialise la partie (les scores repartent de zéro)
- **THEN** le palmarès est inchangé

### Requirement: Filtres adaptés au jeu
Le palmarès MUST se filtrer par **jeu** (Tous les jeux, Demi-disque, Trou du cul, Tarot, et les suivants), par
**période** (depuis toujours, 30 derniers jours, 7 derniers jours) et se classer par une **mesure** propre au jeu :
- Tous les jeux : victoires, % de victoires, parties jouées ;
- Demi-disque (un tour gagné = le meilleur score du tour) : tours gagnés, % de tours gagnés, perfects, points moyens
  par tour, tours joués ;
- Trou du cul (une manche gagnée = Président) : présidences, % de présidences, le moins souvent Trou du cul, manches
  jouées ;
- Tarot (une donne gagnée = dans le camp gagnant) : donnes gagnées, % de donnes gagnées, prises, % de prises réussies,
  meilleure marque, donnes jouées.
Pour un taux, les joueurs avec trop peu de parties (moins de 5 ; moins de 3 prises pour les prises) MUST apparaître à
part, non classés. Il MUST s'ouvrir sur le jeu en cours (le Demi-disque, le jeu de cartes choisi), sinon sur tous les
jeux. Chaque ligne MUST montrer la mesure choisie en grand et son contexte en petit (gagnées / jouées, taux, mesures du
jeu, dernière partie), ma ligne en évidence.

#### Scenario: Le Tarot par prises réussies
- **WHEN** un joueur choisit le jeu Tarot et « % de prises réussies »
- **THEN** les joueurs avec au moins 3 prises sont classés par ce taux, les autres listés à part

#### Scenario: Les 7 derniers jours
- **WHEN** un joueur choisit « 7 derniers jours »
- **THEN** seuls ceux qui ont joué cette semaine apparaissent, avec leurs seuls résultats de la semaine

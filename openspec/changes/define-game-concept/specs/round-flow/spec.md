## ADDED Requirements

### Requirement: Mot et rayon de l'hôte
Au début d'un tour, l'hôte MUST écrire un mot dans la zone de texte sous le demi-disque et placer son rayon ; il ne
MUST pouvoir lancer le tour qu'avec les deux. Son rayon MUST rester caché aux candidats jusqu'à la révélation.

#### Scenario: Lancer le tour
- **WHEN** l'hôte a écrit « Suisse » et placé son rayon, puis clique « Lancer le tour »
- **THEN** tous les joueurs voient le mot « Suisse » et la phase de placement commence

### Requirement: Placement des candidats dans le temps de réponse
Pendant la phase de placement, chaque candidat MUST pouvoir placer puis valider son rayon, avec un minuteur commun
à tous qui dure le temps de réponse de la partie. Un rayon validé MUST devenir visible de tous les joueurs et ne
plus pouvoir changer. Le tour MUST se terminer à la fin du minuteur, ou dès que tous les candidats ont validé.

#### Scenario: Un candidat valide
- **WHEN** un candidat valide son rayon pendant les 30 s
- **THEN** tous les joueurs voient ce rayon dans la couleur du candidat

#### Scenario: Fin du minuteur
- **WHEN** le temps de réponse est écoulé
- **THEN** le tour est révélé et les points sont attribués

#### Scenario: Tous les candidats ont validé
- **WHEN** le dernier candidat valide son rayon avant la fin du minuteur
- **THEN** le minuteur s'arrête et le tour est révélé aussitôt

### Requirement: Temps de réponse choisi par l'hôte
L'hôte MUST pouvoir choisir le temps de réponse parmi 15, 30 et 60 s dans un menu déroulant de l'onglet Partie ;
30 s par défaut. Les autres joueurs le voient en lecture seule.

#### Scenario: Passer à 15 s
- **WHEN** l'hôte choisit 15 s puis lance un tour
- **THEN** le minuteur de ce tour dure 15 s pour tous les joueurs

### Requirement: Règles modifiables sans casser un tour
L'hôte MUST pouvoir changer les règles (activité, sujet, extrémités, temps de réponse, mode de scrutin, résultats
secrets) à tout moment. Un
changement fait pendant le placement des candidats MUST attendre la fin de ce placement ; ailleurs (lobby, phase de
mot de l'hôte, résultats) il MUST s'appliquer aussitôt. Les résultats d'un tour MUST rester affichés dans le mode
de ce tour.

#### Scenario: Changement pendant un placement
- **WHEN** l'hôte passe en mode Amphithéâtre pendant que les candidats placent leur rayon
- **THEN** le tour continue en Rayon libre, l'onglet Partie indique que le changement s'appliquera à la fin du
  placement, et le tour suivant se joue en Amphithéâtre

#### Scenario: Changement pendant la phase de mot
- **WHEN** l'hôte passe le temps de réponse à 60 s avant de lancer le tour
- **THEN** le tour qu'il lance dure 60 s

### Requirement: Points selon la distance, bonus perfect
Chaque candidat ayant validé MUST marquer des points décroissants avec la distance entre son rayon et celui de
l'hôte ; un rayon dans l'épaisseur du rayon de l'hôte MUST recevoir le maximum plus un bonus « perfect ».
(Barème exact : question ouverte, brouillon dans design.md.)

#### Scenario: Perfect
- **WHEN** le rayon d'un candidat est dans la tolérance du rayon de l'hôte
- **THEN** il marque le maximum plus le bonus et le résultat affiche « PERFECT »

### Requirement: Points de l'hôte
À chaque révélation, l'hôte MUST marquer des points selon la proximité des candidats à sa réponse (un mot bien
choisi rapporte), avec un calcul différent de celui des candidats et sans bonus perfect : la moyenne, sur les
candidats qui ont validé, d'une note qui décroît dès le premier écart. Aucun candidat validé : 0 point. Barème
exact : brouillon dans design.md.

#### Scenario: Candidats proches
- **WHEN** tous les candidats sont dans l'épaisseur du rayon de l'hôte
- **THEN** l'hôte marque près du maximum, sans « PERFECT », et sa ligne apparaît dans les résultats

### Requirement: Classement et podium
Les scores MUST s'additionner d'un tour à l'autre et former un classement avec un podium des trois premiers.

#### Scenario: Après un tour
- **WHEN** les points d'un tour sont attribués
- **THEN** le classement et le podium sont mis à jour

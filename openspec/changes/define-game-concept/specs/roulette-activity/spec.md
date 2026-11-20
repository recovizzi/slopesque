## ADDED Requirements

### Requirement: Activité Roulette
L'hôte MUST pouvoir choisir l'activité « Roulette » dans l'onglet Partie, comme « Demi-disque » et « Sondage ». Un changement
d'activité pendant un tour en cours MUST l'annuler (sondage ouvert, tirage, tour, donne), et le dire dans le chat. Un tirage ne
MUST pas rapporter de points.

#### Scenario: Passer à la roulette
- **WHEN** l'hôte choisit « Roulette » pendant sa phase de préparation
- **THEN** la zone de jeu affiche la roue et, à côté, la liste de ses propositions à la place du demi-disque

### Requirement: Construction de la roue dans la zone de jeu
En activité Roulette, l'hôte MUST construire la roue directement dans la zone de jeu : au moins 2 propositions (12 au
plus), chacune avec un libellé et un poids facultatif ; il peut en ajouter et en retirer. Chaque proposition MUST
occuper sur le cercle un secteur proportionnel à sa part. Les autres joueurs MUST voir la roue se construire en
direct (secteurs, libellés, parts) sans pouvoir la modifier.

#### Scenario: Un candidat regarde
- **WHEN** l'hôte ajoute une proposition pendant qu'un candidat regarde
- **THEN** le candidat voit un secteur de plus apparaître sur la roue, sans champ pour la modifier

### Requirement: Poids des propositions
La part d'une proposition avec un poids MUST être ce poids. Les propositions sans poids MUST se partager à parts égales
ce qui reste de 100 une fois les poids donnés retirés. Si le total des poids dépasse 100, une alerte MUST s'afficher et
la roue MUST ne pas pouvoir être lancée. Si le total reste sous 100 sans proposition sans poids, il MUST être ramené
à 100 au lancer en gardant les proportions, sans alerte.

#### Scenario: Poids mixtes
- **WHEN** l'hôte donne 60 et 20 à deux propositions et laisse deux autres sans poids
- **THEN** les parts sont 60 %, 20 %, 10 % et 10 %

#### Scenario: Total sous 100
- **WHEN** l'hôte donne 60 et 20 à ses deux seules propositions
- **THEN** les parts sont 75 % et 25 %, sans alerte

#### Scenario: Total au-dessus de 100
- **WHEN** l'hôte donne 70 et 50
- **THEN** une alerte indique le total (120 %) et le bouton « Lancer la roue » est désactivé

### Requirement: Tirage
L'hôte MUST lancer la roue. Au lancer, un angle MUST être tiré au hasard, uniformément sur le cercle (par le serveur) ;
une aiguille MUST tourner vite autour du centre puis ralentir pour s'arrêter sur cet angle, chez tous les joueurs en
même temps (un joueur qui arrive pendant le tirage voit l'aiguille où elle en est). Le résultat MUST être la
proposition dont le secteur est sous l'aiguille ; il MUST s'afficher à la fin de l'animation, les autres secteurs
estompés. L'hôte MUST pouvoir relancer la même roue ou la modifier.

#### Scenario: Fin du tirage
- **WHEN** l'aiguille s'arrête à 294° sur une roue « Oui » 75 % / « Non » 25 %
- **THEN** « Non » est le résultat (son secteur va de 270° à 360°), affiché à tous avec ses 25 % de chances

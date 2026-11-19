## ADDED Requirements

### Requirement: Tiroir gauche Chat / Classement
Un tiroir à gauche MUST contenir deux onglets, Chat et Classement (« Joueurs » dans une activité sans points, voir
chat-activity), et MUST pouvoir se refermer pour voir le jeu en entier. Dans un panneau étroit il MUST recouvrir le jeu plutôt que l'écraser.

#### Scenario: Refermer le tiroir
- **WHEN** le joueur clique le bouton du tiroir
- **THEN** le tiroir se ferme et le demi-disque occupe toute la largeur

### Requirement: Copier la clé de salon
Un clic sur la clé du salon dans l'en-tête (ou sur la page d'un salon en attente) MUST la copier dans le
presse-papiers et l'indiquer (« Copiée ✓ ») pendant un court instant, ou indiquer que la copie est impossible.

#### Scenario: Partager la clé
- **WHEN** un joueur clique sur la clé dans l'en-tête
- **THEN** la clé est dans son presse-papiers et l'en-tête affiche « Copiée ✓ » pendant environ 1,5 s

### Requirement: Tiroir droit Profil / Extension / Partie
L'icône joueur en haut à droite (sa photo de profil, ou sa lettre sur sa couleur) MUST ouvrir un tiroir à droite avec
les onglets Profil (photo de profil du salon, pseudo, couleur, réaction au double-clic, puis la section Compte : code
utilisateur et bouton rouge pour en changer), Extension
(serveur, liste des salons, thème) et Partie. L'onglet Partie MUST montrer d'abord le choix de l'activité (Demi-disque
ou Sondage ou Roulette ou Chat ou une intégration comme Low Tide), puis un séparateur horizontal, puis les paramètres propres à cette activité (Demi-disque :
sujet, extrémités, mode de scrutin, temps de réponse ; Sondage : temps de réponse, résultats secrets ; Roulette : un
rappel que la roue se règle dans la zone de jeu ; Chat : rien à régler ; intégration : son adresse, vérifiée). Seul l'hôte MUST
pouvoir les changer et réinitialiser la partie ; les autres joueurs les voient en lecture seule.

#### Scenario: Paramètres liés à l'activité
- **WHEN** l'hôte choisit l'activité « Sondage » dans l'onglet Partie
- **THEN** sous le séparateur, les paramètres du demi-disque sont remplacés par « Paramètres du sondage »

#### Scenario: Un candidat ouvre l'onglet Partie
- **WHEN** un candidat ouvre l'onglet Partie
- **THEN** il voit le sujet et les extrémités sans pouvoir les modifier

#### Scenario: L'hôte réinitialise
- **WHEN** l'hôte clique « Réinitialiser la partie »
- **THEN** les scores repassent à zéro et la partie revient au lobby

### Requirement: Couleur par joueur
Chaque joueur MUST avoir une couleur, distincte de celles des autres joueurs de la partie, utilisée partout où il
apparaît (rayon, chat, classement, résultats). À son arrivée, une couleur par défaut libre MUST lui être attribuée.

#### Scenario: Arrivée dans une partie
- **WHEN** un joueur rejoint une partie pour la première fois
- **THEN** il reçoit une couleur par défaut éloignée de celles des joueurs présents

### Requirement: Choix de la couleur sur un dégradé
L'onglet Profil MUST proposer un curseur sur une ligne qui parcourt tout l'arc-en-ciel en couleurs mates ; le bouton
du curseur MUST afficher la couleur sélectionnée et les couleurs des autres joueurs MUST être repérées sous la ligne.
La couleur MUST n'être appliquée qu'après 3 s sans changement du curseur ; une couleur trop proche de celle d'un
autre joueur MUST être refusée.

#### Scenario: Choisir une couleur
- **WHEN** le joueur déplace le curseur puis le laisse 3 s
- **THEN** sa nouvelle couleur s'applique partout, pas avant

#### Scenario: Couleur trop proche
- **WHEN** le joueur laisse le curseur sur la couleur d'un autre joueur
- **THEN** un message l'indique et sa couleur ne change pas

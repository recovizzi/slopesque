## ADDED Requirements

### Requirement: Demi-disque dessiné en contour
La page MUST afficher, sous le titre du sujet, un demi-disque SVG dessiné en contour (ouvert vers le bas, centre au
milieu de la base), avec des graduations discrètes, et sous lui à gauche et à droite le libellé de chaque extrémité.

#### Scenario: Affichage d'un sujet
- **WHEN** le sujet est « Les pays ? » avec les extrémités « de gauche » et « de droite »
- **THEN** le titre « Les pays ? » est au-dessus du demi-disque, « de gauche » sous son extrémité gauche et « de droite » sous son extrémité droite

### Requirement: Sélection d'un rayon par clic
En mode « Rayon libre », quand le joueur peut placer un rayon, un clic dans la zone intérieure du demi-disque MUST sélectionner le rayon qui
passe par le point cliqué, exprimé comme une valeur de 0 (extrémité gauche) à 100 (extrémité droite). Un clic hors
de la zone intérieure MUST être ignoré. Le survol MUST prévisualiser le rayon.

#### Scenario: Clic au sommet
- **WHEN** le joueur clique à la verticale du centre
- **THEN** le rayon sélectionné vaut 50

#### Scenario: Clic hors du demi-disque
- **WHEN** le joueur clique sous la base ou hors de l'arc
- **THEN** aucun rayon n'est sélectionné

### Requirement: Rayons colorés et épaisseur du rayon de l'hôte
Chaque rayon MUST être dessiné dans la couleur de son joueur. Le rayon de l'hôte MUST avoir une épaisseur (un
secteur de ± la tolérance) qui matérialise la zone « perfect ».

#### Scenario: Révélation
- **WHEN** le tour est révélé
- **THEN** le secteur de l'hôte et les rayons de tous les candidats sont visibles, chacun dans sa couleur

### Requirement: Accessibilité clavier
Le demi-disque MUST être utilisable au clavier quand il est actif : flèches pour déplacer le rayon (Maj : par 5),
Début / Fin pour les extrémités, Entrée pour sélectionner.

#### Scenario: Placement au clavier
- **WHEN** le demi-disque a le focus et le joueur appuie sur Fin puis Entrée
- **THEN** le rayon sélectionné vaut 100

### Requirement: Disque responsive sans défilement
La zone de jeu MUST s'adapter à la taille de la fenêtre (en particulier du panneau de l'extension) sans défiler : le
demi-disque MUST prendre la place disponible en gardant ses proportions, avec une taille minimale qui le garde
lisible (en dessous, la zone défile plutôt que de rétrécir). Quand la place manque en hauteur mais pas en largeur, le
contenu MUST passer à l'horizontale : le disque à gauche, le titre et les actions à droite.

#### Scenario: Panneau large et bas
- **WHEN** le panneau mesure 1040 × 430 px
- **THEN** le disque est à gauche, le titre et les actions à droite, sans barre de défilement

#### Scenario: Panneau étroit
- **WHEN** le panneau mesure 400 × 640 px
- **THEN** le titre, le disque et les actions sont empilés, sans barre de défilement
